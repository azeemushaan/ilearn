
// This layout file is intentionally left blank. 
// The protected admin layout has been moved to /admin/(protected)/layout.tsx
// to ensure it does not wrap the /admin/login page.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
