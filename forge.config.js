const fs = require('fs')
const path = require('path')
const glob = require('glob')
module.exports = {
  packagerConfig: {
    icon:'assets/images/icon.ico',
    setupIcon: 'assets/images/icon.ico',
    asar:true,
    ignore:[
      'gulpfile\.js',
      '\.git.*',
      'TODO',
      'notes\.txt',
      'forge\.config\.js',
      'tests',
      'jest\.config\.js'
      ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip'
    }
  ],

      "publishers": [
        {
          "name": "@electron-forge/publisher-github",
          "config": {
            "repository": {
              "owner": "drkNsubuga",
              "name": "PharmaSpot",
              "draft": true
            }
          }
        }
      ],
      //fix issue with packaging linux app
      hooks: {
        packageAfterPrune(config, buildPath) {
          if (process.platform === 'linux') {
            const dirs = glob.sync(
              path.join(buildPath, 'node_modules/**/node_gyp_bins'),
              {
                onlyDirectories: true,
              }
            );
    
            for (const directory of dirs) {
              fs.rmdirSync(directory, { recursive: true, force: true });
            }
          }
        },
      },
};