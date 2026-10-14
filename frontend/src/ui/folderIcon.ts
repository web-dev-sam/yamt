import type { Component } from "vue";
import DefaultFolder from "~icons/vscode-icons/default-folder";
import DefaultFolderOpened from "~icons/vscode-icons/default-folder-opened";
import FolderApi from "~icons/vscode-icons/folder-type-api";
import FolderApiOpened from "~icons/vscode-icons/folder-type-api-opened";
import FolderApp from "~icons/vscode-icons/folder-type-app";
import FolderAppOpened from "~icons/vscode-icons/folder-type-app-opened";
import FolderAsset from "~icons/vscode-icons/folder-type-asset";
import FolderAssetOpened from "~icons/vscode-icons/folder-type-asset-opened";
import FolderAudio from "~icons/vscode-icons/folder-type-audio";
import FolderAudioOpened from "~icons/vscode-icons/folder-type-audio-opened";
import FolderAuth from "~icons/vscode-icons/folder-type-auth";
import FolderAuthOpened from "~icons/vscode-icons/folder-type-auth-opened";
import FolderBinary from "~icons/vscode-icons/folder-type-binary";
import FolderBinaryOpened from "~icons/vscode-icons/folder-type-binary-opened";
import FolderCargo from "~icons/vscode-icons/folder-type-cargo";
import FolderCargoOpened from "~icons/vscode-icons/folder-type-cargo-opened";
import FolderClient from "~icons/vscode-icons/folder-type-client";
import FolderClientOpened from "~icons/vscode-icons/folder-type-client-opened";
import FolderCommon from "~icons/vscode-icons/folder-type-common";
import FolderCommonOpened from "~icons/vscode-icons/folder-type-common-opened";
import FolderComponent from "~icons/vscode-icons/folder-type-component";
import FolderComponentOpened from "~icons/vscode-icons/folder-type-component-opened";
import FolderConfig from "~icons/vscode-icons/folder-type-config";
import FolderConfigOpened from "~icons/vscode-icons/folder-type-config-opened";
import FolderController from "~icons/vscode-icons/folder-type-controller";
import FolderControllerOpened from "~icons/vscode-icons/folder-type-controller-opened";
import FolderCoverage from "~icons/vscode-icons/folder-type-coverage";
import FolderCoverageOpened from "~icons/vscode-icons/folder-type-coverage-opened";
import FolderCss from "~icons/vscode-icons/folder-type-css";
import FolderCssOpened from "~icons/vscode-icons/folder-type-css-opened";
import FolderDb from "~icons/vscode-icons/folder-type-db";
import FolderDbOpened from "~icons/vscode-icons/folder-type-db-opened";
import FolderDist from "~icons/vscode-icons/folder-type-dist";
import FolderDistOpened from "~icons/vscode-icons/folder-type-dist-opened";
import FolderDocker from "~icons/vscode-icons/folder-type-docker";
import FolderDockerOpened from "~icons/vscode-icons/folder-type-docker-opened";
import FolderDocs from "~icons/vscode-icons/folder-type-docs";
import FolderDocsOpened from "~icons/vscode-icons/folder-type-docs-opened";
import FolderE2e from "~icons/vscode-icons/folder-type-e2e";
import FolderE2eOpened from "~icons/vscode-icons/folder-type-e2e-opened";
import FolderFonts from "~icons/vscode-icons/folder-type-fonts";
import FolderFontsOpened from "~icons/vscode-icons/folder-type-fonts-opened";
import FolderGithub from "~icons/vscode-icons/folder-type-github";
import FolderGithubOpened from "~icons/vscode-icons/folder-type-github-opened";
import FolderHelper from "~icons/vscode-icons/folder-type-helper";
import FolderHelperOpened from "~icons/vscode-icons/folder-type-helper-opened";
import FolderHook from "~icons/vscode-icons/folder-type-hook";
import FolderHookOpened from "~icons/vscode-icons/folder-type-hook-opened";
import FolderHusky from "~icons/vscode-icons/folder-type-husky";
import FolderHuskyOpened from "~icons/vscode-icons/folder-type-husky-opened";
import FolderImages from "~icons/vscode-icons/folder-type-images";
import FolderImagesOpened from "~icons/vscode-icons/folder-type-images-opened";
import FolderInclude from "~icons/vscode-icons/folder-type-include";
import FolderIncludeOpened from "~icons/vscode-icons/folder-type-include-opened";
import FolderJs from "~icons/vscode-icons/folder-type-js";
import FolderJsOpened from "~icons/vscode-icons/folder-type-js-opened";
import FolderLibrary from "~icons/vscode-icons/folder-type-library";
import FolderLibraryOpened from "~icons/vscode-icons/folder-type-library-opened";
import FolderLocale from "~icons/vscode-icons/folder-type-locale";
import FolderLocaleOpened from "~icons/vscode-icons/folder-type-locale-opened";
import FolderLog from "~icons/vscode-icons/folder-type-log";
import FolderLogOpened from "~icons/vscode-icons/folder-type-log-opened";
import FolderMiddleware from "~icons/vscode-icons/folder-type-middleware";
import FolderMiddlewareOpened from "~icons/vscode-icons/folder-type-middleware-opened";
import FolderMock from "~icons/vscode-icons/folder-type-mock";
import FolderMockOpened from "~icons/vscode-icons/folder-type-mock-opened";
import FolderModel from "~icons/vscode-icons/folder-type-model";
import FolderModelOpened from "~icons/vscode-icons/folder-type-model-opened";
import FolderNode from "~icons/vscode-icons/folder-type-node";
import FolderNodeOpened from "~icons/vscode-icons/folder-type-node-opened";
import FolderPackage from "~icons/vscode-icons/folder-type-package";
import FolderPackageOpened from "~icons/vscode-icons/folder-type-package-opened";
import FolderPlugin from "~icons/vscode-icons/folder-type-plugin";
import FolderPluginOpened from "~icons/vscode-icons/folder-type-plugin-opened";
import FolderPublic from "~icons/vscode-icons/folder-type-public";
import FolderPublicOpened from "~icons/vscode-icons/folder-type-public-opened";
import FolderRoute from "~icons/vscode-icons/folder-type-route";
import FolderRouteOpened from "~icons/vscode-icons/folder-type-route-opened";
import FolderScript from "~icons/vscode-icons/folder-type-script";
import FolderScriptOpened from "~icons/vscode-icons/folder-type-script-opened";
import FolderServer from "~icons/vscode-icons/folder-type-server";
import FolderServerOpened from "~icons/vscode-icons/folder-type-server-opened";
import FolderServices from "~icons/vscode-icons/folder-type-services";
import FolderServicesOpened from "~icons/vscode-icons/folder-type-services-opened";
import FolderShared from "~icons/vscode-icons/folder-type-shared";
import FolderSharedOpened from "~icons/vscode-icons/folder-type-shared-opened";
import FolderSrc from "~icons/vscode-icons/folder-type-src";
import FolderSrcOpened from "~icons/vscode-icons/folder-type-src-opened";
import FolderStory from "~icons/vscode-icons/folder-type-story";
import FolderStoryOpened from "~icons/vscode-icons/folder-type-story-opened";
import FolderStyle from "~icons/vscode-icons/folder-type-style";
import FolderStyleOpened from "~icons/vscode-icons/folder-type-style-opened";
import FolderTauri from "~icons/vscode-icons/folder-type-tauri";
import FolderTauriOpened from "~icons/vscode-icons/folder-type-tauri-opened";
import FolderTemp from "~icons/vscode-icons/folder-type-temp";
import FolderTempOpened from "~icons/vscode-icons/folder-type-temp-opened";
import FolderTemplate from "~icons/vscode-icons/folder-type-template";
import FolderTemplateOpened from "~icons/vscode-icons/folder-type-template-opened";
import FolderTest from "~icons/vscode-icons/folder-type-test";
import FolderTestOpened from "~icons/vscode-icons/folder-type-test-opened";
import FolderTheme from "~icons/vscode-icons/folder-type-theme";
import FolderThemeOpened from "~icons/vscode-icons/folder-type-theme-opened";
import FolderTools from "~icons/vscode-icons/folder-type-tools";
import FolderToolsOpened from "~icons/vscode-icons/folder-type-tools-opened";
import FolderTypings from "~icons/vscode-icons/folder-type-typings";
import FolderTypingsOpened from "~icons/vscode-icons/folder-type-typings-opened";
import FolderVideo from "~icons/vscode-icons/folder-type-video";
import FolderVideoOpened from "~icons/vscode-icons/folder-type-video-opened";
import FolderView from "~icons/vscode-icons/folder-type-view";
import FolderViewOpened from "~icons/vscode-icons/folder-type-view-opened";
import FolderVscode from "~icons/vscode-icons/folder-type-vscode";
import FolderVscodeOpened from "~icons/vscode-icons/folder-type-vscode-opened";
import FolderWww from "~icons/vscode-icons/folder-type-www";
import FolderWwwOpened from "~icons/vscode-icons/folder-type-www-opened";

import { iconTable, lookup, nameKey, type IconRow } from "./iconTable";

type FolderIcons = Readonly<{ closed: Component; opened: Component }>;

export const FOLDER_ICON_ROWS: readonly IconRow<FolderIcons>[] = [
  [{ closed: FolderApi, opened: FolderApiOpened }, "api .api apis .apis"],
  [{ closed: FolderApp, opened: FolderAppOpened }, "app apps .app application applications"],
  [{ closed: FolderAsset, opened: FolderAssetOpened }, "assets .assets"],
  [
    { closed: FolderAudio, opened: FolderAudioOpened },
    "audio .audio audios .audios sound .sound sounds .sounds",
  ],
  [
    { closed: FolderAuth, opened: FolderAuthOpened },
    "auth authentication authorisation authorization",
  ],
  [{ closed: FolderBinary, opened: FolderBinaryOpened }, "bin .bin"],
  [{ closed: FolderCargo, opened: FolderCargoOpened }, "cargo .cargo crates"],
  [{ closed: FolderClient, opened: FolderClientOpened }, "client clients"],
  [{ closed: FolderCommon, opened: FolderCommonOpened }, "common"],
  [
    { closed: FolderComponent, opened: FolderComponentOpened },
    "component components .components gui src-ui ui widgets",
  ],
  [
    { closed: FolderConfig, opened: FolderConfigOpened },
    "conf .conf cfg .cfg cfgs .cfgs config .config configs .configs configuration .configuration configurations .configurations setting .setting settings .settings ini .ini initializers .initializers",
  ],
  [
    { closed: FolderController, opened: FolderControllerOpened },
    "__controller__ __controllers__ controller controllers .controllers __handler__ __handlers__ handler .handler handlers .handlers",
  ],
  [{ closed: FolderCoverage, opened: FolderCoverageOpened }, "coverage"],
  [{ closed: FolderCss, opened: FolderCssOpened }, "css _css"],
  [
    { closed: FolderDb, opened: FolderDbOpened },
    "db database sql data repo repository repositories store stores storage storages",
  ],
  [{ closed: FolderDocker, opened: FolderDockerOpened }, "docker .docker"],
  [{ closed: FolderDocs, opened: FolderDocsOpened }, "docs doc document documents"],
  [
    { closed: FolderDist, opened: FolderDistOpened },
    "dist .dist dists out outs output outputs export exports build .build builds release releases target targets",
  ],
  [{ closed: FolderE2e, opened: FolderE2eOpened }, "e2e"],
  [{ closed: FolderFonts, opened: FolderFontsOpened }, "fonts font fnt webfonts"],
  [{ closed: FolderGithub, opened: FolderGithubOpened }, ".github"],
  [{ closed: FolderHelper, opened: FolderHelperOpened }, "helper .helper helpers .helpers"],
  [{ closed: FolderHook, opened: FolderHookOpened }, "hook .hook hooks .hooks"],
  [{ closed: FolderHusky, opened: FolderHuskyOpened }, ".husky"],
  [
    { closed: FolderImages, opened: FolderImagesOpened },
    ".fig .figs images image .img img .imgs imgs icons icon ico screenshot screenshots svg texture textures",
  ],
  [
    { closed: FolderInclude, opened: FolderIncludeOpened },
    "include includes incl inc .include .includes .incl .inc _include _includes _incl _inc",
  ],
  [{ closed: FolderJs, opened: FolderJsOpened }, "js"],
  [
    { closed: FolderLibrary, opened: FolderLibraryOpened },
    "lib libs .lib .libs __lib__ __libs__ library libraries",
  ],
  [
    { closed: FolderLocale, opened: FolderLocaleOpened },
    "lang language languages locale locales _locale _locales internationalization globalization localization i18n g11n l10n translation translations",
  ],
  [{ closed: FolderLog, opened: FolderLogOpened }, "log logs logging logger loggers"],
  [{ closed: FolderMiddleware, opened: FolderMiddlewareOpened }, "middleware middlewares"],
  [{ closed: FolderMock, opened: FolderMockOpened }, "mocks .mocks __mocks__"],
  [
    { closed: FolderModel, opened: FolderModelOpened },
    "model .model models .models entities .entities",
  ],
  [{ closed: FolderNode, opened: FolderNodeOpened }, "node_modules"],
  [
    { closed: FolderPackage, opened: FolderPackageOpened },
    "package packages .package .packages pkg",
  ],
  [
    { closed: FolderPlugin, opened: FolderPluginOpened },
    "plugin .plugin plugins .plugins extension .extension extensions .extensions",
  ],
  [{ closed: FolderPublic, opened: FolderPublicOpened }, "public .public"],
  [
    { closed: FolderRoute, opened: FolderRouteOpened },
    "route routes _route _routes router routers",
  ],
  [{ closed: FolderScript, opened: FolderScriptOpened }, "script scripts"],
  [{ closed: FolderServer, opened: FolderServerOpened }, "server"],
  [{ closed: FolderServices, opened: FolderServicesOpened }, "service services"],
  [
    { closed: FolderShared, opened: FolderSharedOpened },
    "share shared .share .shared __shared__ __share__",
  ],
  [{ closed: FolderSrc, opened: FolderSrcOpened }, "src source sources __src__"],
  [{ closed: FolderStory, opened: FolderStoryOpened }, "story stories __stories__ .storybook"],
  [{ closed: FolderStyle, opened: FolderStyleOpened }, "style styles"],
  [{ closed: FolderTauri, opened: FolderTauriOpened }, "src-tauri"],
  [{ closed: FolderTemp, opened: FolderTempOpened }, "temp .temp tmp .tmp"],
  [
    { closed: FolderTemplate, opened: FolderTemplateOpened },
    "template .template templates .templates",
  ],
  [
    { closed: FolderTest, opened: FolderTestOpened },
    "tests .tests test .test __tests__ __test__ spec .spec specs .specs integration",
  ],
  [{ closed: FolderTheme, opened: FolderThemeOpened }, "theme themes"],
  [
    { closed: FolderTools, opened: FolderToolsOpened },
    "tool tools .tools util utils utilities tooling",
  ],
  [{ closed: FolderTypings, opened: FolderTypingsOpened }, "typings types @types"],
  [{ closed: FolderVideo, opened: FolderVideoOpened }, "video .video videos .videos"],
  [
    { closed: FolderView, opened: FolderViewOpened },
    "html view views layout layouts page pages _view _views _layout _layouts _page _pages",
  ],
  [{ closed: FolderVscode, opened: FolderVscodeOpened }, ".vscode vscode"],
  [{ closed: FolderWww, opened: FolderWwwOpened }, ".web www wwwroot web"],
];

const FOLDER_ICONS = iconTable(FOLDER_ICON_ROWS);

const DEFAULT_FOLDER: FolderIcons = { closed: DefaultFolder, opened: DefaultFolderOpened };

export function folderIcon(path: string, open: boolean): Component {
  const icons = lookup(FOLDER_ICONS, nameKey(path)) ?? DEFAULT_FOLDER;
  return open ? icons.opened : icons.closed;
}
