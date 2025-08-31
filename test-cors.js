// Test CORS from production domain
const https = require('https');

// Test OPTIONS request (preflight)
const testCORS = () => {
    console.log('Testing CORS preflight request...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/posts',
        method: 'OPTIONS',
        headers: {
            'Origin': 'https://www.edulink.social',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
        }
    };

    const req = require('http').request(options, (res) => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:');
        Object.keys(res.headers).forEach(key => {
            if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('origin') || key.toLowerCase().includes('access-control')) {
                console.log(`  ${key}: ${res.headers[key]}`);
            }
        });
        
        if (res.headers['access-control-allow-origin']) {
            console.log('✅ CORS headers present - should work!');
        } else {
            console.log('❌ Missing Access-Control-Allow-Origin header');
        }
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.end();
};

// Test actual POST request
const testPost = () => {
    console.log('\nTesting actual POST request...');
    
    const postData = JSON.stringify({
        userId: 'test-user',
        description: 'Test post from CORS test',
        imageUrls: []
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/posts',
        method: 'POST',
        headers: {
            'Origin': 'https://www.edulink.social',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = require('http').request(options, (res) => {
        console.log('POST Response Status:', res.statusCode);
        console.log('POST Response Headers:');
        Object.keys(res.headers).forEach(key => {
            if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('origin') || key.toLowerCase().includes('access-control')) {
                console.log(`  ${key}: ${res.headers[key]}`);
            }
        });
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('Response body:', data);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with POST request: ${e.message}`);
    });

    req.write(postData);
    req.end();
};

// Run tests
setTimeout(() => {
    testCORS();
    setTimeout(() => {
        testPost();
    }, 1000);
}, 1000);
