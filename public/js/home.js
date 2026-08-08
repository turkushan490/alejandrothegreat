(async () => {
  const auth = await authReady;
  const status = auth.status;

  // If the app isn't set up yet, this is a fresh install - send the very
  // first visitor straight to the setup wizard.
  if (status && !status.configured) {
    window.location.href = '/setup.html';
    return;
  }

  // Show the redirect-uri admin helper (handy for the login error).
  if (status?.redirectUri) {
    document.getElementById('redirectUri').textContent = status.redirectUri;
    document.getElementById('adminHint').hidden = false;
    document.getElementById('copyRedirect').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(status.redirectUri);
        document.getElementById('copyRedirect').textContent = 'Copied ✓';
      } catch {
        /* clipboard may be blocked on http - user can select manually */
      }
    });
  }

  // Signed in: swap the hero "Sign in" button for the "Open dashboard" link.
  // (The top bar itself is rendered by app.js.)
  if (auth.user) {
    const dash = document.getElementById('dashLink');
    if (dash) dash.hidden = false;
    const heroSignIn = document.getElementById('heroSignIn');
    if (heroSignIn) heroSignIn.hidden = true;
  }
})();
