const fs = require('fs');
const path = require('path');

const distPath = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distPath, 'assets');

// Verificar si el directorio de assets existe
if (fs.existsSync(assetsDir)) {
  const jsFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.js'));
  
  jsFiles.forEach(file => {
    const filePath = path.join(assetsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Elimina timestamps
    content = content.replace(/\b\d{10}\b/g, '0');
    
    // 2. Elimina direcciones IP privadas
    content = content.replace(/\b(10|172|192\.168)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '0.0.0.0');
    
    // 3. Elimina patrones específicos de AWS
    content = content.replace(/\bip-\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}\b/g, 'internal-host');
    
    // 4. Elimina comentarios
    content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    
    fs.writeFileSync(filePath, content);
  });
  
  console.log('IPs privadas y timestamps eliminados de todos los archivos JS');
} else {
  console.log('No se encontró directorio assets, omitiendo procesamiento');
}