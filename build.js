const electronInstaller = require("electron-winstaller");
const path = require("path");
const pkg = require("./package.json");

const rootPath = path.join("./");

resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: path.join(rootPath, "release-builds",`${pkg.name}-win32-x64`),
    outputDirectory: path.join(rootPath,"installers"),
    authors: pkg.author,
    noMsi: true,
    exe: `${pkg.name}.exe`,
    setupExe: "${pkg.name.toLowerCase()}-setup-win32-x64.exe",
    setupIcon: path.join(rootPath, "assets", "images", "icon.ico"),
});

resultPromise.then(
    () => console.log("It worked!"),
    (e) => console.log(`No dice: ${e.message}`),
);