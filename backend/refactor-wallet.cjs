import fs from 'fs';

function replaceWalletLogic(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // predictions.js
  if (filePath.includes('predictions.js')) {
    if (!content.includes('../walletUtils.js')) {
      content = "import { getHouseWallet } from '../walletUtils.js';\n" + content;
    }
    content = content.replace(
      "const secret = JSON.parse(fs.readFileSync('houseWallet.json', 'utf8'))\n      const houseWallet = Keypair.fromSecretKey(new Uint8Array(secret))",
      "const houseWallet = getHouseWallet()"
    );
  }

  // server.js
  if (filePath.includes('server.js')) {
    if (!content.includes('./walletUtils.js')) {
      content = 'import { getHouseWallet } from "./walletUtils.js";\n' + content;
    }

    content = content.replace(
      /if \(\!fs\.existsSync\("houseWallet\.json"\)\) \{\s*return res\.status\(500\)\.json\(\{ error: "House wallet not configured" \}\);\s*\}\s*const secret = JSON\.parse\(fs\.readFileSync\("houseWallet\.json", "utf8"\)\);\s*const houseWallet = Keypair\.fromSecretKey\(new Uint8Array\(secret\)\);/g,
      "const houseWallet = getHouseWallet();"
    );

    content = content.replace(
      /const secret = JSON\.parse\(fs\.readFileSync\("houseWallet\.json", "utf8"\)\);\s*const houseWallet = Keypair\.fromSecretKey\(new Uint8Array\(secret\)\);/g,
      "const houseWallet = getHouseWallet();"
    );
  }

  fs.writeFileSync(filePath, content);
}

replaceWalletLogic('./src/routes/predictions.js');
replaceWalletLogic('./src/server.js');
