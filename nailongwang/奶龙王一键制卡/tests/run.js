const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    console.error(`[失败] ${name}`);
    process.exit(result.status || 1);
  }

  console.log(`[通过] ${name}`);
}

run('coc7-runtime-investigator-edit', 'node', ['tests/coc7-runtime-investigator-edit.test.js']);
run('coc7-runtime-investigator-card-layout', 'node', ['tests/coc7-runtime-investigator-card-layout.test.js']);
run('release-verifier', 'node', ['tests/release-verifier.test.js']);
run('workflow-clean', 'node', ['tests/workflow-clean.test.js']);
run('validate-project', 'node', ['tools/validate-project.js']);
run('shujuku-local', 'node', ['tests/shujuku-local.test.js']);
run('shujuku-frontend', 'node', ['tests/shujuku-frontend.test.js']);
run('shujuku-full', 'node', ['tests/shujuku-full.test.js']);

console.log('[通过] 全部测试通过');
