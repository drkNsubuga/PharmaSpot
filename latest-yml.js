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

async function generateWindowsMacYml(installerDir) {
  // Use electron-updater-yaml for Windows/macOS
  const version = pkg.version;
  const releaseDate = new Date().toISOString();
  const channel = 'latest';

  const options = {
    version,
    releaseDate,
    channel,
    installerPath: installerDir,
    // platform: you can explicitly set, but defaults to the host platform
  };

  const yml = await getChannelYml(options);
  const outPath = path.join(installerDir, 'latest.yml');
  fs.writeFileSync(outPath, yml, 'utf8');
  console.log('Generated latest.yml (win/mac) at', outPath);
}

async function generateLinuxYml(installerDir) {
  // Manually create linux metadata
  const version = pkg.version;
  const releaseDate = new Date().toISOString();

  const files = fs.readdirSync(installerDir)
    .filter(f => /\.(deb|rpm|zip)$/.test(f));

  if (files.length === 0) {
    console.log('No Linux installers found; skipping linux metadata');
    return;
  }

  const entries = await Promise.all(files.map(async f => {
    const full = path.join(installerDir, f);
    const checksum = await sha512(full);
    return {
      file: f,
      sha512: checksum,
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
    console.error('Installer directory not found:', installerDir);
    process.exit(1);
  }

  // Windows/macOS jobs will generate `latest.yml`
  if (process.platform === 'darwin' || process.platform === 'win32') {
    await generateWindowsMacYml(installerDir);
  }

  // Linux job
  if (process.platform === 'linux') {
    await generateLinuxYml(installerDir);
  }
}

main().catch(err => {
  console.error('Error generating latest metadata:', err);
  process.exit(1);
});
