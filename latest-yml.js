// latest-yml.js
const fs = require('fs');
const path = require('path');
const { getChannelYml } = require('electron-updater-yaml');
const pkg = require('./package.json');

async function main() {
  // Path where your installers go
  const installerDir = path.resolve(__dirname, 'out/make');
  // Ensure directory exists, or adjust if your installers are in different paths
  if (!fs.existsSync(installerDir)) {
    console.error('Installer directory not found:', installerDir);
    process.exit(1);
  }

  const version = pkg.version;
  const releaseDate = new Date().toISOString();
  const channel = 'latest';

  const options = {
    version,
    releaseDate,
    channel,
    installerPath: installerDir
  };

  const yml = await getChannelYml(options);
  const latestPath = path.join(installerDir, 'latest.yml');
  fs.writeFileSync(latestPath, yml, 'utf8');
  console.log('Generated latest.yml at', latestPath);
}

main().catch(err => {
  console.error('Error generating latest.yml:', err);
  process.exit(1);
});
