# Testing Instructions for GitHub PII Scanner Extension

## Step 1: Create Icons (Required)

Since the extension needs icon files, you have two options:

### Option A: Generate Icons with HTML File
1. Open `create-icons.html` in your browser
2. Click the download buttons to save `icon16.png`, `icon48.png`, and `icon128.png`
3. Move these files to the `icons/` folder

### Option B: Use Placeholder Images
Create simple placeholder files:
```bash
cd icons/
# Create minimal PNG files (you can replace these later)
echo "PNG placeholder" > icon16.png
echo "PNG placeholder" > icon48.png  
echo "PNG placeholder" > icon128.png
```

## Step 2: Install the Extension

1. **Open Chrome** and navigate to: `chrome://extensions/`

2. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `chrome-extension` folder
   - The extension should appear in your extensions list

4. **Pin the Extension**:
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "GitHub PII Scanner" for easy access

## Step 3: Test the Extension

### Test 1: Basic Functionality
1. Navigate to any GitHub repository (e.g., `https://github.com/octocat/Hello-World`)
2. Look for the "Scan for PII" button in the repository header
3. If the button appears, the content script is working correctly

### Test 2: Extension Popup
1. Click the extension icon in the toolbar
2. The popup should open with three tabs: Scan, Results, Settings
3. Try entering a GitHub repo URL in the "Custom Scan" section

### Test 3: Scanning Test Repository
Let's test with a repository that might contain some PII patterns:

1. Go to: `https://github.com/microsoft/vscode` (or any large public repo)
2. Click the "Scan for PII" button
3. The extension should:
   - Show "Scanning..." status
   - Fetch repository files
   - Analyze for PII patterns
   - Display results

### Test 4: Settings Configuration
1. Open the extension popup
2. Go to Settings tab
3. Try saving a GitHub token (optional but recommended for testing)
4. Adjust scan options

## Step 4: Debugging

### Check Console for Errors
1. **Background Script**: Go to `chrome://extensions/`, find your extension, click "Inspect views: service worker"
2. **Content Script**: Right-click on a GitHub page → Inspect → Console tab
3. **Popup**: Right-click extension popup → Inspect

### Common Issues and Solutions

1. **"Scan for PII" button not appearing**:
   - Check if you're on a repository page (not user profile)
   - Look in browser console for JavaScript errors
   - Refresh the page

2. **"GitHub API error: 403"**:
   - You've hit GitHub's rate limit
   - Add a GitHub Personal Access Token in Settings
   - Wait a few minutes and try again

3. **Extension not loading**:
   - Check manifest.json syntax
   - Ensure all file paths are correct
   - Look for errors in chrome://extensions/

4. **No scan results**:
   - Try a smaller repository first
   - Check if the repo has scannable files (js, py, etc.)
   - Look for API errors in console

## Step 5: Test with Different Repositories

Try scanning these types of repositories:

1. **Small public repo**: `https://github.com/octocat/Hello-World`
2. **Your own repo**: Test with a repository you own
3. **Large public repo**: `https://github.com/microsoft/vscode`
4. **Repository with potential PII**: Look for repos with config files, logs, etc.

## Expected Results

The extension should detect and categorize:

- 📧 **Email addresses**: `user@example.com`
- 📞 **Phone numbers**: `(555) 123-4567`
- 🔑 **API keys**: `api_key="abc123..."`
- 🌐 **IP addresses**: `192.168.1.1`
- And other PII types as defined in the scanner

For each finding, it should show:
- File name and line number
- Whether data appears encrypted/hashed
- Security recommendations
- Severity level (high/medium/low)

## Troubleshooting Commands

If you need to check file structure:
```bash
# Verify all files exist
ls -la chrome-extension/
ls -la chrome-extension/icons/

# Check file permissions
chmod +r chrome-extension/*
```

## Next Steps

Once basic testing works:
1. Test with private repositories (requires GitHub token)
2. Test with different file types
3. Verify encryption detection accuracy
4. Test performance with large repositories

## Security Note

Remember: This extension makes API calls to GitHub and processes repository content. Only use it on repositories you have permission to scan. 