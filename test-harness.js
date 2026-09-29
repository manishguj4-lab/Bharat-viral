const { execSync } = require('child_process');

try {
  execSync('npm run test --prefix testing', { stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}
