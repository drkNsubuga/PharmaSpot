const fs = require('fs');
const path = require('path');
const { getChannelYml } = require('electron-updater-yaml');
const pkg = require('./package.json');

async function generateLatestYml(platform, installerPath) {
  const version = pkg.version;
  const releaseDate = new Date().toISOString();
  const channel = 'latest';

  const options = {
    version,
    releaseDate,
    channel,
    installerPath
  };

  const yml = await getChannelYml(options);
  const latestPath = path.join(installerPath, 'latest.yml');
  fs.writeFileSync(latestPath, yml, 'utf8');
  console.log(`Generated latest.yml for ${platform} at`, latestPath);
}

async function main() {
  const platform = process.platform;
  const installerDir = path.resolve(__dirname, 'out/make');

  if (!fs.existsSync(installerDir)) {
    console.error('Installer directory not found:', installerDir);
    process.exit(1);
  }

  if (platform === 'linux') {
    const formats = ['deb', 'rpm', 'zip', 'AppImage'];
    for (const format of formats) {
      const formatDir = path.join(installerDir, format);
      if (fs.existsSync(formatDir)) {
        await generateLatestYml('linux', formatDir);
      }
    }
  } else {
    await generateLatestYml(platform, installerDir);
  }
}

main().catch(err => {
  console.error('Error generating latest.yml:', err);
  process.exit(1);
});
