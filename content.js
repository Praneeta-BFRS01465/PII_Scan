// Content script for GitHub PII Scanner
(function() {
  'use strict';

  class GitHubPIIUI {
    constructor() {
      this.scanButton = null;
      this.resultsContainer = null;
      this.isScanning = false;
      this.init();
    }

    init() {
      // Wait for page to load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.injectUI());
      } else {
        this.injectUI();
      }

      // Handle navigation in SPAs
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          setTimeout(() => this.injectUI(), 1000);
        }
      }).observe(document, { subtree: true, childList: true });
    }

    injectUI() {
      if (!this.isRepositoryPage()) return;
      
      // Remove existing UI
      this.removeExistingUI();
      
      // Create scan button
      this.createScanButton();
      
      // Create results container
      this.createResultsContainer();
    }

    isRepositoryPage() {
      return /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/.test(window.location.href) ||
             /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/tree\//.test(window.location.href);
    }

    removeExistingUI() {
      const existing = document.querySelectorAll('.pii-scanner-button, .pii-scanner-results');
      existing.forEach(el => el.remove());
    }

    createScanButton() {
      const repoHeader = document.querySelector('[data-testid="repository-container-header"]') ||
                        document.querySelector('.repository-content') ||
                        document.querySelector('#repository-container-header');
      
      if (!repoHeader) return;

      this.scanButton = document.createElement('button');
      this.scanButton.className = 'btn btn-outline pii-scanner-button';
      this.scanButton.innerHTML = `
        <svg class="octicon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
        </svg>
        Scan for PII
      `;
      this.scanButton.style.marginLeft = '8px';
      this.scanButton.addEventListener('click', () => this.startScan());

      // Find a good place to insert the button
      const actionList = repoHeader.querySelector('.d-flex') || repoHeader;
      actionList.appendChild(this.scanButton);
    }

    createResultsContainer() {
      this.resultsContainer = document.createElement('div');
      this.resultsContainer.className = 'pii-scanner-results';
      this.resultsContainer.style.display = 'none';
      
      const mainContent = document.querySelector('#repo-content-pjax-container') ||
                         document.querySelector('.repository-content') ||
                         document.querySelector('main');
      
      if (mainContent) {
        mainContent.insertBefore(this.resultsContainer, mainContent.firstChild);
      }
    }

    async startScan() {
      if (this.isScanning) return;
      
      this.isScanning = true;
      this.updateScanButton('scanning');
      
      try {
        const repoUrl = window.location.href;
        const accessToken = await this.getAccessToken();
        
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'scanRepository',
            repoUrl: repoUrl,
            accessToken: accessToken
          }, resolve);
        });

        if (response.success) {
          this.displayResults(response.data);
          // Save results for popup
          chrome.runtime.sendMessage({
            action: 'saveResults',
            results: response.data
          });
        } else {
          this.showError(response.error);
        }
      } catch (error) {
        this.showError(error.message);
      }
      
      this.isScanning = false;
      this.updateScanButton('idle');
    }

    async getAccessToken() {
      // Try to get GitHub token from storage or prompt user
      return new Promise((resolve) => {
        chrome.storage.sync.get(['githubToken'], (result) => {
          if (result.githubToken) {
            resolve(result.githubToken);
          } else {
            const token = prompt('Enter GitHub Personal Access Token (optional, for private repos):');
            if (token) {
              chrome.storage.sync.set({ githubToken: token });
            }
            resolve(token);
          }
        });
      });
    }

    updateScanButton(state) {
      if (!this.scanButton) return;
      
      switch (state) {
        case 'scanning':
          this.scanButton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Scanning...
          `;
          this.scanButton.disabled = true;
          break;
        case 'idle':
        default:
          this.scanButton.innerHTML = `
            <svg class="octicon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
            Scan for PII
          `;
          this.scanButton.disabled = false;
          break;
      }
    }

    displayResults(results) {
      if (!this.resultsContainer) return;

      const hasFindings = results.findings && results.findings.length > 0;
      const highSeverityCount = results.findings.filter(f => f.severity === 'high').length;
      
      this.resultsContainer.innerHTML = `
        <div class="flash flash-${hasFindings ? (highSeverityCount > 0 ? 'error' : 'warn') : 'success'} pii-scan-results">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h4>🔍 PII Scan Results for ${results.repository}</h4>
              <p>
                Scanned ${results.filesScanned} files • 
                Found ${results.findings.length} potential PII items • 
                ${highSeverityCount} high severity issues
              </p>
            </div>
            <button class="btn-link text-gray" onclick="this.parentElement.parentElement.parentElement.style.display='none'">
              ✕
            </button>
          </div>
          
          ${hasFindings ? this.renderFindings(results.findings) : '<p>✅ No PII detected in scanned files!</p>'}
          
          <div class="mt-3">
            <small class="text-gray">
              Scan completed on ${new Date(results.scanDate).toLocaleString()}
            </small>
          </div>
        </div>
      `;
      
      this.resultsContainer.style.display = 'block';
    }

    renderFindings(findings) {
      const groupedFindings = this.groupFindingsByType(findings);
      
      return `
        <div class="mt-3">
          ${Object.entries(groupedFindings).map(([type, items]) => `
            <details class="pii-finding-group" open>
              <summary class="h5 text-${items[0].severity === 'high' ? 'danger' : 'warning'}">
                ${this.getPIITypeIcon(type)} ${type.toUpperCase()} (${items.length} found)
              </summary>
              <div class="ml-3 mt-2">
                ${items.slice(0, 5).map(item => `
                  <div class="border rounded p-2 mb-2 bg-gray-light">
                    <div class="d-flex justify-content-between">
                      <strong>📁 ${item.file}:${item.line}</strong>
                      <span class="Label Label--${item.severity === 'high' ? 'danger' : 'warning'}">
                        ${item.encrypted ? '🔒 Encrypted' : '⚠️ Plain Text'}
                      </span>
                    </div>
                    <code class="text-small">${this.escapeHtml(item.context)}</code>
                    <p class="text-small text-gray mt-1">${item.recommendation}</p>
                  </div>
                `).join('')}
                ${items.length > 5 ? `<p class="text-small text-gray">... and ${items.length - 5} more</p>` : ''}
              </div>
            </details>
          `).join('')}
        </div>
      `;
    }

    groupFindingsByType(findings) {
      return findings.reduce((groups, finding) => {
        const type = finding.type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(finding);
        return groups;
      }, {});
    }

    getPIITypeIcon(type) {
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

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    showError(error) {
      if (!this.resultsContainer) return;
      
      this.resultsContainer.innerHTML = `
        <div class="flash flash-error">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h4>❌ Scan Error</h4>
              <p>${this.escapeHtml(error)}</p>
            </div>
            <button class="btn-link text-gray" onclick="this.parentElement.parentElement.parentElement.style.display='none'">
              ✕
            </button>
          </div>
        </div>
      `;
      
      this.resultsContainer.style.display = 'block';
    }
  }

  // Initialize the extension
  new GitHubPIIUI();
})(); 