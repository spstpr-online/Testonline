const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
content = content.replace(/\\\$\{/g, '${');
fs.writeFileSync('index.html', content);
console.log('Fixed', content.match(/\$\{/g)?.length, 'interpolations');
