document.getElementById("signBtn").onclick = function(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorMessage = document.getElementById("errorMessage");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    // Clear previous error states
    errorMessage.className = 'error-message';
    errorMessage.style.display = 'none';
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');

    // Check if fields are empty
    if (!username || !password) {
        errorMessage.textContent = 'Please fill in both username and password.';
        errorMessage.className = 'error-message show';
        errorMessage.style.display = 'block';

        if (!username) usernameInput.classList.add('error');
        if (!password) passwordInput.classList.add('error');
        return;
    }

    // Simple login check
    if (username === "admin" && password === "1234") {
        // Save login status
        localStorage.setItem('isLoggedIn', 'true');
        window.location.href = "index.html";
    } else {
        // Show error message
        errorMessage.textContent = 'Invalid username or password. Please try again.';
        errorMessage.className = 'error-message show';
        errorMessage.style.display = 'block';

        // Highlight both fields
        usernameInput.classList.add('error');
        passwordInput.classList.add('error');

        // Clear password field
        passwordInput.value = '';
        passwordInput.focus();
    }
};

// Allow Enter key to submit
document.getElementById("password").addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        document.getElementById("signBtn").click();
    }
});

// Clear error on input
document.getElementById("username").addEventListener("input", function() {
    this.classList.remove('error');
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.className = 'error-message';
    errorMessage.style.display = 'none';
});

document.getElementById("password").addEventListener("input", function() {
    this.classList.remove('error');
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.className = 'error-message';
    errorMessage.style.display = 'none';
});