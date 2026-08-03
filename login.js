document.getElementById("signBtn").onclick = function(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorMessage = document.getElementById("errorMessage");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");


    // Simple login check
    if (username === "admin" && password === "1234") {
        // Save login status
        localStorage.setItem('isLoggedIn', 'true');
        window.location.href = "index.html";
    } else {
        // Clear password field
        errorMessage.textContent = 'Invalid username or password';
        errorMessage.style.display = 'block';
        passwordInput.value = '';
        passwordInput.classList.add('error');
        usernameInput.classList.add('error');
        passwordInput.focus();
    }
};

// REDUNDANT - commented out: signBtn is a type="submit" button inside a <form>,
// so pressing Enter in either input already triggers its click handler natively.
// document.getElementById("password").addEventListener("keypress", function(e) {
//     if (e.key === "Enter") {
//         document.getElementById("signBtn").click();
//     }
// });
