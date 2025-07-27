import { useEffect } from 'react';

export function usePrismCopyFunctionality() {
  useEffect(() => {
    const addCopyFunctionality = () => {
      // Find all Prism code blocks
      const codeBlocks = document.querySelectorAll('.milkdown pre[class*="language-"]');
      
      codeBlocks.forEach((pre) => {
        // Skip if already has copy functionality
        if (pre.getAttribute('data-copy-enabled')) return;
        
        pre.setAttribute('data-copy-enabled', 'true');
        
        // Add click handler for copy button (::after pseudo-element)
        const handleCopyClick = async (e: MouseEvent) => {
          const rect = pre.getBoundingClientRect();
          const clickX = e.clientX;
          const clickY = e.clientY;
          
          // Check if click is in the copy button area (top-right corner)
          const buttonArea = {
            left: rect.right - 60,
            right: rect.right - 8,
            top: rect.top + 8,
            bottom: rect.top + 40
          };
          
          if (clickX >= buttonArea.left && clickX <= buttonArea.right && 
              clickY >= buttonArea.top && clickY <= buttonArea.bottom) {
            
            e.preventDefault();
            e.stopPropagation();
            
            const code = pre.querySelector('code');
            if (!code) return;
            
            const text = code.textContent || '';
            
            try {
              await navigator.clipboard.writeText(text);
              
              // Show success feedback
              pre.setAttribute('data-copied', 'true');
              setTimeout(() => {
                pre.removeAttribute('data-copied');
              }, 2000);
              
            } catch (err) {
              console.error('Failed to copy code:', err);
            }
          }
        };
        
        // Add keyboard handler for Ctrl/Cmd+A to copy
        const handleKeyDown = async (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
            e.preventDefault();
            
            const code = pre.querySelector('code');
            if (!code) return;
            
            const text = code.textContent || '';
            
            try {
              await navigator.clipboard.writeText(text);
              
              // Show success feedback
              pre.setAttribute('data-copied', 'true');
              setTimeout(() => {
                pre.removeAttribute('data-copied');
              }, 2000);
              
            } catch (err) {
              console.error('Failed to copy code:', err);
            }
          }
        };
        
        // Make the pre element focusable for keyboard interaction
        pre.setAttribute('tabindex', '0');
        
        // Add event listeners
        pre.addEventListener('click', handleCopyClick);
        pre.addEventListener('keydown', handleKeyDown);
        
        // Store cleanup function
        (pre as any)._cleanupCopy = () => {
          pre.removeEventListener('click', handleCopyClick);
          pre.removeEventListener('keydown', handleKeyDown);
          pre.removeAttribute('data-copy-enabled');
          pre.removeAttribute('tabindex');
        };
      });
      
      // Handle mermaid diagrams
      const mermaidBlocks = document.querySelectorAll('.milkdown pre[class*="language-mermaid"]');
      mermaidBlocks.forEach(async (pre) => {
        const code = pre.querySelector('code');
        if (!code) return;
        
        const content = code.textContent || '';
        if (!content.trim()) return;
        
        // Create mermaid diagram container
        let diagramContainer = pre.querySelector('.mermaid-diagram');
        if (!diagramContainer) {
          diagramContainer = document.createElement('div');
          diagramContainer.className = 'mermaid-diagram';
          pre.appendChild(diagramContainer);
          
          try {
            const mermaid = (await import('mermaid')).default;
            
            if (!(mermaid as any).hasBeenInitialized) {
              const isDark = document.documentElement.classList.contains('dark');
              mermaid.initialize({
                startOnLoad: false,
                theme: isDark ? 'dark' : 'default',
                themeVariables: {
                  primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                  background: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
                  mainBkg: getComputedStyle(document.documentElement).getPropertyValue('--card').trim(),
                },
                fontFamily: 'inherit',
                fontSize: 14,
              });
              (mermaid as any).hasBeenInitialized = true;
            }
            
            const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const { svg } = await mermaid.render(uniqueId, content);
            diagramContainer.innerHTML = svg;
            
          } catch (error) {
            console.error('Mermaid rendering error:', error);
            diagramContainer.innerHTML = `
              <div class="text-destructive text-center p-4">
                <div class="font-medium mb-2">Failed to render diagram</div>
                <div class="text-sm opacity-75">${error instanceof Error ? error.message : 'Unknown error'}</div>
              </div>
            `;
          }
        }
      });
    };
    
    // Run initially
    addCopyFunctionality();
    
    // Set up mutation observer to catch dynamically added code blocks
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'PRE' || element.querySelector('pre[class*="language-"]')) {
                shouldProcess = true;
              }
            }
          });
        }
      });
      
      if (shouldProcess) {
        setTimeout(addCopyFunctionality, 100);
      }
    });
    
    // Observe the editor container
    const editorContainer = document.querySelector('.milkdown') || document.body;
    observer.observe(editorContainer, {
      childList: true,
      subtree: true
    });
    
    return () => {
      observer.disconnect();
      
      // Clean up existing copy functionality
      const codeBlocks = document.querySelectorAll('.milkdown pre[data-copy-enabled]');
      codeBlocks.forEach((pre) => {
        if ((pre as any)._cleanupCopy) {
          (pre as any)._cleanupCopy();
        }
      });
    };
  }, []);
}