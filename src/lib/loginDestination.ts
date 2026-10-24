/** After a successful sign-in, always open the dashboard — never the last protected URL. */
export function dashboardPathAfterLogin(): string {
  try {
    sessionStorage.removeItem('newport_post_login_path')
  } catch {
    // ignore
  }
  return '/'
}
