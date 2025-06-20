// Popup script for GitHub PII Scanner
document.addEventListener('DOMContentLoaded', function() {
    const scanCurrentBtn = document.getElementById('scanCurrentRepo');
    const scanCustomBtn = document.getElementById('scanCustomRepo');
    const repoUrlInput = document.getElementById('repoUrl');
    const scanStatus = document.getElementById('scanStatus');
    const statusText = document.getElementById('statusText');
    const scanResults = document.getElementById('scanResults');
    const githubTokenInput = document.getElementById('githubToken');
    const saveTokenBtn = document.getElementById('saveToken');
    const saveSettingsBtn = document.getElementById('saveSettings');

    // Load saved settings
    loadSettings();
    loadResults();

    // Event listeners
    scanCurrentBtn.addEventListener('click', scanCurrentRepository);
    scanCustomBtn.addEventListener('click', scanCustomRepository);
    saveTokenBtn.addEventListener('click', saveToken);
    saveSettingsBtn.addEventListener('click', saveSettings);

    async function scanCurrentRepository() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url || !tab.url.includes('github.com')) {
                showError('Please navigate to a GitHub repository page first.');
                return;
            }

            const repoMatch = tab.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!repoMatch) {
                showError('Could not detect repository from current page.');
                return;
            }

            await performScan(tab.url);
        } catch (error) {
            showError('Error accessing current tab: ' + error.message);
        }
    }

    async function scanCustomRepository() {
        const url = repoUrlInput.value.trim();
        if (!url) {
            showError('Please enter a repository URL.');
            return;
        }

        if (!url.includes('github.com')) {
            showError('Please enter a valid GitHub repository URL.');
            return;
        }

        await performScan(url);
    }

    async function performScan(repoUrl) {
        try {
            showScanning();
            
            const apiUrl = `http://localhost:8000/api/scan`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    repository: repoUrl,
                }),
            });

            hideScanning();

            if (response.ok) {
                const results = await response.json();
                if (results.success) {
                    displayResults(results);
                    chrome.storage.local.set({ lastScanResults: results });
                    switchTab('results');
                } else {
                    showError(results.error || 'The API returned an error.');
                }
            } else {
                const errorText = await response.text();
                showError(`API request failed with status ${response.status}: ${errorText}`);
            }
        } catch (error) {
            hideScanning();
            showError('Scan failed: ' + error.message);
        }
    }

    function showScanning() {
        scanStatus.classList.remove('hidden');
        statusText.textContent = 'Scanning repository for PII...';
        scanCurrentBtn.disabled = true;
        scanCustomBtn.disabled = true;
    }

    function hideScanning() {
        scanStatus.classList.add('hidden');
        scanCurrentBtn.disabled = false;
        scanCustomBtn.disabled = false;
    }

    function showError(message) {
        scanResults.className = 'results error';
        scanResults.innerHTML = `<p><strong>Error:</strong> ${escapeHtml(message)}</p>`;
        switchTab('results');
    }

    function displayResults(results) {
        const hasFindings = results.findings && results.findings.length > 0;
        
        let className = 'results success';
        if (hasFindings) {
            const hasCritical = results.risk_level === 'critical';
            className = hasCritical ? 'results error' : 'results warning';
        }

        scanResults.className = className;
        
        let html = `
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 5px 0;">📊 Scan Summary</h4>
                <p style="margin: 0; font-size: 11px;">
                    Repository: <strong>${results.repository}</strong><br>
                    Risk Level: <strong style="text-transform: capitalize;">${results.risk_level}</strong><br>
                    Files scanned: ${results.files_scanned}<br>
                    Total issues: ${results.total_issues}
                </p>
            </div>
        `;

        if (hasFindings) {
            html += '<div style="margin-bottom: 10px;"><strong>🔍 Findings:</strong></div>';
            
            results.findings.forEach(fileFinding => {
                fileFinding.findings.forEach(finding => {
                    html += `
                        <div class="finding-item ${finding.risk}">
                            <div style="font-weight: bold; font-size: 11px;">
                                📁 ${fileFinding.file}
                            </div>
                    `;
                    finding.matches.forEach(match => {
                       html += `
                           <div class="finding-detail">
                               <div><strong>${finding.type}</strong> (${finding.risk})</div>
                               <div class="finding-meta">
                                   <span class="badge ${match.visibility}">${match.visibility}</span>
                                   <span class="badge ${match.context_type}">${match.context_type}</span>
                               </div>
                               <div class="finding-line">Line ${match.line_number}: <code>${escapeHtml(match.line_content)}</code></div>
                               <div class="finding-suggestion"><em>Suggestion: ${finding.suggestion}</em></div>
                           </div>
                       `;
                    });
                    html += `</div>`;
                });
            });

        } else {
            html += '<p>✅ <strong>Great!</strong> No PII detected in the scanned files.</p>';
        }

        html += `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #666;">
                Scan completed: ${new Date().toLocaleString()}
            </div>
        `;

        scanResults.innerHTML = html;
    }

    function groupFindingsByType(findings) {
        return findings.reduce((groups, finding) => {
            const type = finding.type;
            if (!groups[type]) groups[type] = [];
            groups[type].push(finding);
            return groups;
        }, {});
    }

    function getPIITypeIcon(type) {
        const icons = {
            email: '📧',
            phone: '📞',
            ssn: '🆔',
            creditCard: '💳',
            apiKey: '🔑',
            ipAddress: '🌐',
            privateKey: '🔐',
            jwt: '🎫'
        };
        return icons[type] || '🔍';
    }

    async function saveToken() {
        const token = githubTokenInput.value.trim();
        
        try {
            await chrome.storage.sync.set({ githubToken: token });
            
            // Visual feedback
            const originalText = saveTokenBtn.textContent;
            saveTokenBtn.textContent = 'Saved!';
            saveTokenBtn.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
                saveTokenBtn.textContent = originalText;
                saveTokenBtn.style.backgroundColor = '';
            }, 2000);
        } catch (error) {
            showError('Failed to save token: ' + error.message);
        }
    }

    async function saveSettings() {
        try {
            const settings = {
                includeTests: document.getElementById('includeTests').checked,
                includeDocs: document.getElementById('includeDocs').checked
            };
            
            await chrome.storage.sync.set({ scanSettings: settings });
            
            // Visual feedback
            const originalText = saveSettingsBtn.textContent;
            saveSettingsBtn.textContent = 'Saved!';
            saveSettingsBtn.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
                saveSettingsBtn.textContent = originalText;
                saveSettingsBtn.style.backgroundColor = '';
            }, 2000);
        } catch (error) {
            showError('Failed to save settings: ' + error.message);
        }
    }

    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['githubToken', 'scanSettings']);
            
            if (result.githubToken) {
                githubTokenInput.value = result.githubToken;
            }
            
            if (result.scanSettings) {
                document.getElementById('includeTests').checked = result.scanSettings.includeTests;
                document.getElementById('includeDocs').checked = result.scanSettings.includeDocs;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async function loadResults() {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getResults' }, resolve);
            });
            
            if (response.success && response.data) {
                displayResults(response.data);
            }
        } catch (error) {
            console.error('Failed to load results:', error);
        }
    }

    async function getStoredToken() {
        try {
            const result = await chrome.storage.sync.get(['githubToken']);
            return result.githubToken || null;
        } catch (error) {
            return null;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

// Tab switching functionality
function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`.tab:nth-child(${getTabIndex(tabName)})`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function getTabIndex(tabName) {
    const tabs = { scan: 1, results: 2, settings: 3 };
    return tabs[tabName] || 1;
} 