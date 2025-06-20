// Background script for GitHub PII Scanner
class PIIScanner {
  constructor() {
    this.piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g,
      ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      apiKey: /(?:api[_-]?key|token|secret|password)['":\s]*['"]\w{16,}['"]/gi,
      ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      privateKey: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
      jwt: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g
    };
    
    this.encryptionIndicators = [
      'encrypt', 'decrypt', 'cipher', 'hash', 'bcrypt', 'scrypt',
      'sha256', 'sha512', 'md5', 'aes', 'rsa', 'base64',
      'crypto', 'cryptographic', 'encoded', 'hashed'
    ];
  }

  async scanRepository(repoUrl, accessToken = null) {
    try {
      const repoInfo = this.parseRepoUrl(repoUrl);
      if (!repoInfo) throw new Error('Invalid repository URL');

      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-PII-Scanner'
      };
      
      if (accessToken) {
        headers['Authorization'] = `token ${accessToken}`;
      }

      // Check repository accessibility first
      await this.checkRepositoryAccess(repoInfo, headers, accessToken);

      // Get repository tree
      const treeUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/HEAD?recursive=1`;
      const treeResponse = await fetch(treeUrl, { headers });
      
      if (!treeResponse.ok) {
        if (treeResponse.status === 404) {
          throw new Error(`Repository not found or private. ${!accessToken ? 'For private repositories, please add a GitHub Personal Access Token in Settings.' : 'Check if your token has access to this repository.'}`);
        } else if (treeResponse.status === 403) {
          throw new Error(`Access forbidden. ${!accessToken ? 'For private repositories, please add a GitHub Personal Access Token in Settings.' : 'Your token may not have the required permissions or API rate limit exceeded.'}`);
        } else if (treeResponse.status === 401) {
          throw new Error('Authentication failed. Please check your GitHub Personal Access Token in Settings.');
        } else {
          throw new Error(`GitHub API error: ${treeResponse.status} - ${treeResponse.statusText}`);
        }
      }
      
      const treeData = await treeResponse.json();
      const files = treeData.tree.filter(item => 
        item.type === 'blob' && this.shouldScanFile(item.path)
      );

      const scanResults = {
        repository: `${repoInfo.owner}/${repoInfo.repo}`,
        scanDate: new Date().toISOString(),
        filesScanned: files.length,
        findings: []
      };

      // Scan files in batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch.map(file => 
          this.scanFile(repoInfo, file.path, headers)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            scanResults.findings.push(...result.value);
          }
        });

        // Rate limiting delay
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return scanResults;
    } catch (error) {
      console.error('Scan error:', error);
      throw error;
    }
  }

  async checkRepositoryAccess(repoInfo, headers, accessToken) {
    const repoUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;
    const response = await fetch(repoUrl, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository not found or private. ${!accessToken ? 'For private repositories, please add a GitHub Personal Access Token in Settings.' : 'Check if your token has access to this repository.'}`);
      } else if (response.status === 403) {
        throw new Error(`Access forbidden. ${!accessToken ? 'For private repositories, please add a GitHub Personal Access Token in Settings.' : 'Your token may not have the required permissions.'}`);
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please check your GitHub Personal Access Token in Settings.');
      }
    }
    
    const repoData = await response.json();
    return {
      isPrivate: repoData.private,
      hasAccess: true,
      repoData: repoData
    };
  }

  parseRepoUrl(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return null;
    
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, '')
    };
  }

  shouldScanFile(path) {
    const excludePatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /\.min\./,
      /\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i
    ];
    
    const includePatterns = [
      /\.(js|ts|jsx|tsx|py|java|php|rb|go|rs|cpp|c|h|cs|sql|json|xml|yaml|yml|env|config|log|txt|md)$/i
    ];

    return !excludePatterns.some(pattern => pattern.test(path)) &&
           includePatterns.some(pattern => pattern.test(path));
  }

  async scanFile(repoInfo, filePath, headers) {
    try {
      const fileUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${filePath}`;
      const response = await fetch(fileUrl, { headers });
      
      if (!response.ok) return null;
      
      const fileData = await response.json();
      if (fileData.size > 1000000) return null; // Skip files larger than 1MB
      
      const content = atob(fileData.content);
      const findings = [];
      
      for (const [type, pattern] of Object.entries(this.piiPatterns)) {
        const matches = [...content.matchAll(pattern)];
        
        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index);
          const context = this.getContext(content, match.index);
          const isEncrypted = this.isLikelyEncrypted(context, match[0]);
          
          findings.push({
            type,
            value: this.maskSensitiveData(match[0]),
            file: filePath,
            line: lineNumber,
            context: context.substring(0, 200),
            encrypted: isEncrypted,
            severity: isEncrypted ? 'low' : 'high',
            recommendation: isEncrypted ? 
              'Data appears to be encrypted, but verify implementation' : 
              'Sensitive data detected in plain text - should be encrypted'
          });
        }
      }
      
      return findings;
    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error);
      return null;
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  getContext(content, index, contextLength = 100) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    return content.substring(start, end);
  }

  isLikelyEncrypted(context, value) {
    const contextLower = context.toLowerCase();
    
    // Check for encryption indicators in context
    const hasEncryptionKeywords = this.encryptionIndicators.some(keyword => 
      contextLower.includes(keyword)
    );
    
    // Check if value looks encrypted/encoded
    const looksEncoded = (
      value.length > 20 &&
      (/^[A-Za-z0-9+/]+=*$/.test(value) || // Base64-like
       /^[A-Fa-f0-9]+$/.test(value) || // Hex-like
       /^\$2[aby]\$/.test(value)) // Bcrypt-like
    );
    
    return hasEncryptionKeywords || looksEncoded;
  }

  maskSensitiveData(value) {
    if (value.length <= 4) return '***';
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanRepository') {
    const scanner = new PIIScanner();
    scanner.scanRepository(request.repoUrl, request.accessToken)
      .then(results => {
        sendResponse({ success: true, data: results });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'saveResults') {
    chrome.storage.local.set({ scanResults: request.results }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getResults') {
    chrome.storage.local.get(['scanResults'], (result) => {
      sendResponse({ success: true, data: result.scanResults || null });
    });
    return true;
  }
}); 