/**
 * Portal Layout — wraps all public website pages.
 * No auth, no dashboard chrome.
 * Spec: MOD_11 Section 5.2
 */

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
