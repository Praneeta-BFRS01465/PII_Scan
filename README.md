# GitHub PII Scanner Chrome Extension

A powerful Chrome extension that scans GitHub repositories for Personally Identifiable Information (PII) and analyzes whether the data is properly encrypted or exposed in plain text.

## 🔍 Features

- **Comprehensive PII Detection**: Scans for emails, phone numbers, SSNs, credit cards, API keys, private keys, JWT tokens, and IP addresses
- **Encryption Analysis**: Determines if detected PII is encrypted/hashed or exposed in plain text
- **Real-time Scanning**: Inject scan functionality directly into GitHub repository pages
- **Detailed Reports**: Provides file-by-file analysis with security recommendations
- **Privacy-First**: All scanning happens locally, no data sent to external servers
- **GitHub Integration**: Works seamlessly with public and private repositories

## 📦 Installation

### Option 1: Load as Unpacked Extension (Development)

1. **Download the extension files** to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in the top-right corner)
4. **Click "Load unpacked"** and select the `chrome-extension` folder
5. **Pin the extension** to your toolbar for easy access

### Option 2: Package and Install

1. **Package the extension**:
   ```bash
   # Navigate to the chrome-extension directory
   cd chrome-extension
   # Chrome will package this into a .crx file
   ```
2. **Install via Chrome Extensions page**

## 🚀 Usage

### Quick Start

1. **Navigate to any GitHub repository** in your browser
2. **Look for the "Scan for PII" button** in the repository header
3. **Click the button** to start scanning
4. **View results** directly on the page or in the extension popup

### Extension Popup

Click the extension icon to access:

- **Scan Tab**: Quick scan current repo or enter custom repository URL
- **Results Tab**: View detailed scan results with findings breakdown
- **Settings Tab**: Configure GitHub token and scan options

### GitHub Token Setup (Optional)

For private repositories and higher rate limits:

1. Generate a **Personal Access Token** at [GitHub Settings](https://github.com/settings/tokens)
2. **Required permissions**: `repo` (for private repos) or `public_repo` (for public repos)
3. **Enter the token** in the extension's Settings tab
4. **Token is stored securely** in Chrome's storage

## 🔒 Security Features

### PII Types Detected

- **📧 Email addresses**: `user@example.com`
- **📞 Phone numbers**: `(555) 123-4567`, `+1-555-123-4567`
- **🆔 Social Security Numbers**: `123-45-6789`
- **💳 Credit card numbers**: `4111-1111-1111-1111`
- **🔑 API keys & tokens**: `api_key="abc123..."`, `Bearer eyJ...`
- **🔐 Private keys**: `-----BEGIN PRIVATE KEY-----`
- **🌐 IP addresses**: `192.168.1.1`
- **🎫 JWT tokens**: `eyJhbGciOiJIUzI1NiJ9...`

### Encryption Detection

The extension analyzes context around detected PII to determine if it's:

- **🔒 Encrypted/Hashed**: Data appears to be properly secured
- **⚠️ Plain Text**: Sensitive data exposed without encryption

Detection methods:
- **Keyword analysis**: Looks for encryption-related terms
- **Pattern recognition**: Identifies hashed/encoded formats
- **Context evaluation**: Analyzes surrounding code

## 📊 Results Interpretation

### Severity Levels

- **🔴 High Severity**: Plain text PII that should be encrypted
- **🟡 Medium Severity**: Potentially sensitive data requiring review
- **🟢 Low Severity**: Properly encrypted/hashed data

### Recommendations

Each finding includes specific recommendations:
- Encryption methods to implement
- Security best practices
- Code review suggestions

## ⚙️ Configuration

### Scan Options

- **Include test files**: Scan files in test directories
- **Include documentation**: Scan README, docs, and markdown files
- **File type filters**: Customize which files to scan

### Privacy Settings

- **Local processing**: All scanning happens in your browser
- **Token storage**: GitHub tokens stored securely in Chrome storage
- **No data collection**: No user data or scan results sent externally

## 🛠️ Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension APIs
- **Content Script**: Injects UI into GitHub pages
- **Background Worker**: Handles GitHub API calls and PII analysis
- **Popup Interface**: Provides detailed controls and results

### API Integration

- **GitHub API v3**: Fetches repository contents
- **Rate limiting**: Implements delays to respect API limits
- **Authentication**: Supports personal access tokens

### Performance

- **Batch processing**: Scans files in batches to avoid timeouts
- **File filtering**: Skips binary and irrelevant files
- **Size limits**: Automatically skips files larger than 1MB

## 🔧 Development

### File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls
├── content.js            # Injected into GitHub pages
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── styles.css            # Extension styling
└── README.md             # This file
```

### Key Classes

- **PIIScanner**: Core scanning logic and pattern matching
- **GitHubPIIUI**: UI injection and interaction
- **Results processing**: Analysis and recommendation engine

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature-name`
3. **Make your changes** and test thoroughly
4. **Submit a pull request** with detailed description

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This tool is for security research and educational purposes. Always:

- **Review scan results manually** before taking action
- **Follow responsible disclosure** for vulnerabilities found
- **Respect repository owners** and GitHub's terms of service
- **Use with permission** when scanning repositories you don't own

## 🆘 Support

Having issues? Check these common solutions:

### Common Issues

1. **"GitHub API error: 403"**
   - Add a GitHub personal access token in settings
   - Check token permissions and expiration

2. **Scan button not appearing**
   - Refresh the GitHub page
   - Ensure you're on a repository page (not user profile)
   - Check that the extension is enabled

3. **No results showing**
   - Verify repository has scannable files
   - Check browser console for errors
   - Try scanning a smaller repository first

### Getting Help

- **GitHub Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share feedback
- **Security Issues**: Report privately to maintainers

---

**Made with ❤️ for developers who care about security** 