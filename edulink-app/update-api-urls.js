// This script updates all frontend API calls to use the centralized config
// Run this in the frontend directory to update all hardcoded URLs

const fs = require('fs');
const path = require('path');

const oldUrl = 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net';

const filesToUpdate = [
    'src/pages/SearchPage.jsx',
    'src/pages/ProfilePage.jsx', 
    'src/pages/NotificationsPage.jsx',
    'src/pages/ChatPage.jsx',
    'src/components/Post.jsx',
    'src/components/CreatePost.jsx'
];

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add import at the top
        if (!content.includes("import { apiCall") && !content.includes("import { API_BASE_URL")) {
            const importRegex = /(import.*from.*['"];?\n)/g;
            const matches = content.match(importRegex);
            if (matches) {
                const lastImport = matches[matches.length - 1];
                content = content.replace(lastImport, lastImport + "import { apiCall, API_BASE_URL } from '../config/api';\n");
            }
        }
        
        // Replace fetch calls
        content = content.replace(
            new RegExp(`fetch\\s*\\(\\s*['"\`]${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^'"\`]*)['"\`]`, 'g'),
            "apiCall('$1'"
        );
        
        // Replace socket.io URL
        content = content.replace(
            new RegExp(`io\\s*\\(\\s*['"]${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
            "io(API_BASE_URL"
        );
        
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    }
});

console.log('All files updated!');
