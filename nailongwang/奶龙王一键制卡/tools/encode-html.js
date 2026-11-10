const fs = require('fs');
const path = require('path');

function encodeHtmlToBase64(htmlContent) {
  return Buffer.from(htmlContent).toString('base64');
}

function createInjectScript(base64Html, tableName) {
  return `<script>
(function() {
  try {
    const tableData = atob("${base64Html}");
    const tables = JSON.parse(tableData);
    if (window.AutoCardUpdaterAPI) {
      window.AutoCardUpdaterAPI.initGameSession(tables);
    }
  } catch(e) {
    console.error('初始化表格失败:', e);
  }
})();
</script>`;
}

function createStatusBarScript(tableUid, columns) {
  return `<script>
(function() {
  try {
    if (!window.AutoCardUpdaterAPI) return;
    
    const data = window.AutoCardUpdaterAPI.exportTableAsJson("${tableUid}");
    if (!data || !data.rows) return;
    
    let html = '<div class="status-bar">\\n';
    ${columns.map(col => `
    html += '<div class="status-item">\\n';
    html += '<span class="status-label">${col.name}:</span>\\n';
    html += '<span class="status-value">' + (data.rows[0]?.${col.key} || '-') + '</span>\\n';
    html += '</div>\\n';`).join('')}
    html += '</div>';
    
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) {
    console.error('状态栏更新失败:', e);
  }
})();
</script>`;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node encode-html.js <html文件路径> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --base64     仅输出Base64编码');
    console.log('  --inject     生成表格注入脚本');
    console.log('  --status     生成状态栏脚本');
    console.log('');
    console.log('示例:');
    console.log('  node encode-html.js opening.html --base64');
    console.log('  node encode-html.js table.json --inject');
    process.exit(0);
  }
  
  const htmlPath = args[0];
  const option = args[1] || '--base64';
  
  try {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    
    switch (option) {
      case '--base64':
        const encoded = encodeHtmlToBase64(content);
        console.log('Base64编码结果:');
        console.log(encoded);
        break;
        
      case '--inject':
        const tableData = JSON.parse(content);
        const base64 = encodeHtmlToBase64(JSON.stringify(tableData));
        const injectScript = createInjectScript(base64, 'table');
        console.log('注入脚本:');
        console.log(injectScript);
        break;
        
      case '--status':
        const table = JSON.parse(content);
        const statusScript = createStatusBarScript(table.uid, table.columns);
        console.log('状态栏脚本:');
        console.log(statusScript);
        break;
        
      default:
        console.error('未知选项:', option);
    }
  } catch (error) {
    console.error('处理失败:', error.message);
    process.exit(1);
  }
}

main();