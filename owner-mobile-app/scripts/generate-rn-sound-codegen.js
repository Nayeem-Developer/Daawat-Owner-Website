const { spawnSync } = require("node:child_process");
const path = require("node:path");

const androidDir = path.join(__dirname, "..", "android");
const baseArgs = [
  ":react-native-sound:generateCodegenSchemaFromJavaScript",
  ":react-native-sound:generateCodegenArtifactsFromSchema",
];

const command =
  process.platform === "win32" ? "cmd.exe" : "./gradlew";
const args =
  process.platform === "win32"
    ? ["/c", "gradlew.bat", ...baseArgs]
    : baseArgs;

const result = spawnSync(command, args, {
  cwd: androidDir,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
