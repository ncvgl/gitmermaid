/**
 * Converts any GitHub URL format to a clone URL
 * Handles: https://github.com/user/repo, user/repo, git@github.com:user/repo.git, etc.
 * @param {string} url - Any GitHub URL format
 * @returns {string|null} - Clone URL (https://github.com/user/repo.git) or null if invalid
 */
export function getGitCloneUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  
  // Patterns to extract org/repo from various GitHub URL formats
  const patterns = [
    // https://github.com/user/repo (with optional paths, .git, etc.)
    /^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s\?#]+?)(?:\.git)?(?:\/.*)?$/,
    // git@github.com:user/repo.git
    /^git@github\.com:([^\/\s]+)\/([^\/\s\?#]+?)(?:\.git)?$/,
    // github.com/user/repo
    /^github\.com\/([^\/\s]+)\/([^\/\s\?#]+?)(?:\.git)?(?:\/.*)?$/,
    // user/repo (shorthand)
    /^([^\/\s]+)\/([^\/\s\?#]+?)(?:\.git)?$/
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      const org = match[1];
      const repo = match[2].replace(/\.git$/, '');
      
      // Basic validation
      if (org && repo && /^[\w\-\.]+$/.test(org) && /^[\w\-\.]+$/.test(repo)) {
        return `https://github.com/${org}/${repo}.git`;
      }
    }
  }

  return null;
}