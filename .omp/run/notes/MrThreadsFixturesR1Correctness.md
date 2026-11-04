# MrThreadsFixturesR1Correctness

Agent output (`agent://MrThreadsFixturesR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsFixturesR1Correctness.md), collected 2026-11-04T13:28:45.635Z.

{
  "verdict": "pass",
  "checked": [
    "#2339: upload_of (address.rs:123) accepts d01's `/-/project/7/uploads/903a…e8/shot.png` on gitlab.com → route projects/7/uploads/<hex>/shot.png. Ran fake glab on that route: a 32×32 PNG from uploads/7/uploads/<hex>/.",
    "#2340: glab:109 `posts=${posts:-0}`. Ran a draft_notes read on an empty mktemp state with stderr kept: exit 0, no `integer expected` line.",
    "Note 903 hashes the same in all 11 files with d01: base, after-post-1/3/4/5 for 90 and 91-90, and refused. Batch entries equal the single 90/91 files at every k. Only the gitlab.com, docs.example and images.example hosts remain.",
    "After-post deltas hold: k1 d01+951; k3 resolved; k4 open; k5 d01+952,953 and d05+954. Both scenarios' project.json are on gitlab.com, as are post-1's avatar_url and refused post-3.err.",
    "sourcepos 7:1-7:70 matches the 70-char body. The anchor/img shape matches mr-description -52. The old pictures attachment file is gone, and the README row names the uploads route.",
    "Accepted: the one-line project.json, the bulk sed and the avatar risk (avatar_source has no tie to an origin). Brief drift is the orchestrator's: mr-threads-fixtures.md:63 and :105 still give the old project and upload."
  ],
  "findings": []
}
