// generate-latest.js (root of project)
const fs = require('fs');
const path = require('path');
const { getChannelYml } = require('electron-updater-yaml');
const crypto = require('crypto');
const pkg = require('./package.json');

async function sha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function generateWinMac(installerDir) {
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
  const outPath = path.join(installerDir, 'latest.yml');
  fs.writeFileSync(outPath, yml, 'utf8');
  console.log('Generated latest.yml (Windows/macOS) at', outPath);
}

async function generateLinux(installerDir) {
  const version = pkg.version;
  const releaseDate = new Date().toISOString();

  // accepted Linux installer extensions including zip
  const linuxExts = ['.deb', '.rpm', '.zip', /* add others you build */];

  const files = fs.readdirSync(installerDir)
    .filter(fn => {
      const ext = path.extname(fn).toLowerCase();
      return linuxExts.includes(ext);
    });

  if (files.length === 0) {
    console.log('No Linux installers found (zip, rpm, deb)… skipping Linux metadata');
    return;
  }

  const entries = await Promise.all(files.map(async f => {
    const full = path.join(installerDir, f);
    const hash = await sha512(full);
    return {
      file: f,
      sha512: hash
    };
  }));

  const yamlLines = [
    `version: ${version}`,
    `releaseDate: ${releaseDate}`,
    `platform: linux`,
    `files:`,
    ...entries.map(e => `  - file: ${e.file}\n    sha512: ${e.sha512}`)
  ];

  const outPath = path.join(installerDir, 'latest-linux.yml');
  fs.writeFileSync(outPath, yamlLines.join('\n'), 'utf8');
  console.log('Generated latest-linux.yml at', outPath);
}

async function main() {
  const installerDir = path.resolve(__dirname, 'out/make');
  if (!fs.existsSync(installerDir)) {
    console.error('Installer directory does not exist:', installerDir);
    process.exit(1);
  }

  if (process.platform === 'win32' || process.platform === 'darwin') {
    await generateWinMac(installerDir);
  } else if (process.platform === 'linux') {
    await generateLinux(installerDir);
  } else {
    console.log('Platform not covered for metadata generation:', process.platform);
  }
}

main().catch(err => {
  console.error('Error generating latest metadata:', err);
  process.exit(1);
});
