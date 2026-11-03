import type * as Generated from "./bindings";
import { pause } from "./fixture";
import {
  FREE_TIER_PERSON,
  fixtureRows,
  fixtureUploadedPicture,
  PEOPLE,
  REFUSED_PERSON,
  SEARCH_ONLY_PEOPLE,
} from "./fixtureMergeRequestData";
import type { Log } from "./log";
import { toPeopleChangeReply, toPeopleSearchReply, type PeopleChange } from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";

const FIXTURE_SEARCH_MS = 300;
const PEOPLE_CHANGE_PAUSE_MS = 1000;
const FOUND_LIMIT = 20;
const KNOWN_PEOPLE = [...PEOPLE, ...SEARCH_ONLY_PEOPLE];

function found(text: string): Generated.Person[] {
  const wanted = text.toLowerCase();
  return KNOWN_PEOPLE.filter(
    ({ username, name }) =>
      username.toLowerCase().includes(wanted) || name.toLowerCase().includes(wanted),
  ).slice(0, FOUND_LIMIT);
}

function peopleWithout(
  people: Generated.MergeRequestPeople,
  change: PeopleChange,
): Generated.MergeRequestPeople {
  switch (change.group) {
    case "assignees":
      return {
        ...people,
        assignees: people.assignees.filter((each) => each.username !== change.username),
      };
    case "reviewers":
      return {
        ...people,
        reviewers: people.reviewers.filter((each) => each.person.username !== change.username),
      };
    default: {
      const _exhaustive: never = change.group;
      return _exhaustive;
    }
  }
}

function peopleWith(
  people: Generated.MergeRequestPeople,
  group: PeopleChange["group"],
  person: Generated.Person,
): Generated.MergeRequestPeople {
  switch (group) {
    case "assignees":
      return people.assignees.some((each) => each.username === person.username)
        ? people
        : { ...people, assignees: [...people.assignees, person] };
    case "reviewers":
      return people.reviewers.some((each) => each.person.username === person.username)
        ? people
        : { ...people, reviewers: [...people.reviewers, { person, state: "requested" }] };
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

function changeReply(
  iid: number,
  people: Generated.MergeRequestPeople | null,
  change: PeopleChange,
): Generated.PeopleChangeReply {
  if (people === null) {
    return { kind: "failed", message: `GitLab sent no merge request !${iid}` };
  }
  if (change.username === REFUSED_PERSON) {
    return { kind: "refused", message: `Cannot assign @${REFUSED_PERSON} to !${iid}` };
  }
  if (change.action === "remove") {
    return { kind: "changed", people: peopleWithout(people, change) };
  }
  const person = KNOWN_PEOPLE.find((each) => each.username === change.username);
  if (person === undefined || person.username === FREE_TIER_PERSON) {
    return { kind: "unchanged", people };
  }
  return { kind: "changed", people: peopleWith(people, change.group, person) };
}

/** GitLab's people search, and its changes over the listed rows' people, kept per iid until the page reloads. */
export function peopleScript(
  log: Log,
  listedRows: number,
): Pick<MergeRequestSource, "searchPeople" | "changePeople"> {
  const changed = new Map<number, Generated.MergeRequestPeople>();
  function peopleOf(iid: number): Generated.MergeRequestPeople | null {
    const row = fixtureRows(0, listedRows).find((each) => each.iid === iid);
    const listed =
      row === undefined ? null : { assignees: row.assignees, reviewers: row.reviewers };
    return changed.get(iid) ?? listed;
  }
  return {
    async searchPeople(text) {
      log.info("mergeRequests.fixture_people_search", { text });
      await pause(FIXTURE_SEARCH_MS);
      const reply = toPeopleSearchReply(
        { kind: "found", people: found(text) },
        fixtureUploadedPicture,
      );
      return { ok: true, value: reply };
    },
    async changePeople(iid, change) {
      const { group, action, username } = change;
      log.info("mergeRequests.fixture_people_change", { iid, group, action, username });
      await pause(PEOPLE_CHANGE_PAUSE_MS);
      const reply = changeReply(iid, peopleOf(iid), change);
      if (reply.kind === "changed") {
        changed.set(iid, reply.people);
      }
      return { ok: true, value: toPeopleChangeReply(reply, fixtureUploadedPicture) };
    },
  };
}
