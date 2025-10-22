// public/sidebar.js
document.addEventListener('DOMContentLoaded', () => {
    const backToHomeLink = document.getElementById('back-to-home-link');

    if (backToHomeLink) {
        backToHomeLink.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default link behavior

            const enteredPassword = prompt("Please enter the password to access Sales:");

            // Do nothing if the user cancels the prompt
            if (enteredPassword === null) {
                return;
            }

            // Temporarily indicate loading (optional)
            backToHomeLink.style.pointerEvents = 'none';
            backToHomeLink.style.opacity = '0.7';

            try {
                const response = await fetch('/api/verify-sales-key', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password: enteredPassword }),
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Password correct, redirect
                    window.location.href = 'appointments.html';
                } else {
                    // Password incorrect or other error
                    alert(result.message || 'Verification failed. Please try again.');
                }
            } catch (error) {
                console.error('Error verifying password:', error);
                alert('An error occurred while trying to verify the password. Please check the console or try again.');
            } finally {
                // Re-enable the link
                backToHomeLink.style.pointerEvents = 'auto';
                backToHomeLink.style.opacity = '1';
            }
        });
    }
});
