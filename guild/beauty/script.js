// JavaScript部分

// Get all elements with the class '.toggle-button'
const toggleButtons = document.querySelectorAll('.toggle-button');

// Iterate over each button
toggleButtons.forEach(button => {
    // Add a click event listener to each button
    button.addEventListener('click', function() {
        // Get the value of the 'data-target' attribute from the clicked button
        const targetId = this.dataset.target;
        // Get the container element corresponding to that ID
        const targetContainer = document.getElementById(targetId);

        // Only proceed if the container element exists
        if (targetContainer) {
            // Toggle the 'is-visible' class on the container to show/hide it
            targetContainer.classList.toggle('is-visible');

            // Also toggle the button text
            if (targetContainer.classList.contains('is-visible')) {
                // If currently visible, change text to '閉じる' (Collapse)
                // Replace the part before 'を展開' with the same text, but change 'を展開' to 'を閉じる'
                this.textContent = this.textContent.replace('を展開', 'を閉じる');
            } else {
                 // If currently hidden, change text to '展開' (Expand)
                 // Replace the part before 'を閉じる' with the same text, but change 'を閉じる' to 'を展開'
                this.textContent = this.textContent.replace('を閉じる', 'を展開');
            }
        }
    });
});

// Optional: Ensure button text is correct on page load based on initial visibility
// This part is mainly for robustness if initial state isn't strictly 'display: none'
 toggleButtons.forEach(button => {
     const targetContainer = document.getElementById(button.dataset.target);
     if (targetContainer && !targetContainer.classList.contains('is-visible')) {
         // If container is hidden on load, ensure button text ends with 'を展開'
         if (!button.textContent.endsWith('を展開')) {
             button.textContent = button.textContent.replace('を閉じる', 'を展開');
         }
     } else {
         // If container is visible on load (shouldn't happen with initial CSS, but for safety)
          if (!button.textContent.endsWith('を閉じる')) {
             button.textContent = button.textContent.replace('を展開', 'を閉じる');
         }
     }
 });
