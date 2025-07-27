import { useEffect } from 'react';

export function useCollaborativeCursorEnhancement() {
  useEffect(() => {
    // Generate a random vibrant color
    const generateRandomColor = () => {
      const colors = [
        '#ff6b6b', // Red
        '#4ecdc4', // Teal
        '#45b7d1', // Blue
        '#96ceb4', // Green
        '#feca57', // Yellow
        '#ff9ff3', // Pink
        '#54a0ff', // Light Blue
        '#5f27cd', // Purple
        '#00d2d3', // Cyan
        '#ff9f43', // Orange
        '#10ac84', // Emerald
        '#ee5a24', // Red Orange
        '#0abde3', // Sky Blue
        '#feca57', // Golden
        '#48dbfb', // Light Cyan
        '#ff3838', // Bright Red
        '#17c0eb', // Aqua
        '#7bed9f', // Light Green
        '#70a1ff', // Soft Blue
        '#5352ed', // Indigo
      ];
      
      return colors[Math.floor(Math.random() * colors.length)];
    };

    const enhanceCursors = () => {
      // Find all collaborative cursors
      const cursors = document.querySelectorAll('.ProseMirror-yjs-cursor');
      
      cursors.forEach((cursor, index) => {
        // Skip if already enhanced
        if (cursor.getAttribute('data-enhanced')) return;
        
        cursor.setAttribute('data-enhanced', 'true');
        
        const cursorDiv = cursor.querySelector('div');
        if (!cursorDiv) return;
        
        // Generate a random color for this cursor
        const randomColor = generateRandomColor();
        
        // Set CSS custom property for the random accent color
        (cursor as HTMLElement).style.setProperty('--cursor-color', randomColor);
        
        // Improve the username display
        const username = cursorDiv.textContent || 'Unknown User';
        const cleanUsername = username.replace(/^User-/, '').trim();
        
        if (cleanUsername && cleanUsername !== username) {
          cursorDiv.textContent = `User ${cleanUsername}`;
        }
        
        // Don't override theme styling - let CSS handle all the theming
        // This ensures the glass effect and proper colors are maintained
      });
    };
    
    // Run initially
    enhanceCursors();
    
    // Set up mutation observer to catch new cursors
    const observer = new MutationObserver((mutations) => {
      let shouldEnhance = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.classList.contains('ProseMirror-yjs-cursor') || 
                  element.querySelector('.ProseMirror-yjs-cursor')) {
                shouldEnhance = true;
              }
            }
          });
        }
        
        // Also check for attribute changes on existing cursors
        if (mutation.type === 'attributes' && 
            mutation.target instanceof Element &&
            mutation.target.classList.contains('ProseMirror-yjs-cursor')) {
          shouldEnhance = true;
        }
      });
      
      if (shouldEnhance) {
        setTimeout(enhanceCursors, 100);
      }
    });
    
    // Observe the editor container
    const editorContainer = document.querySelector('.milkdown') || document.body;
    observer.observe(editorContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    // Also listen for theme changes
    const themeObserver = new MutationObserver(() => {
      setTimeout(enhanceCursors, 100);
    });
    
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, []);
}