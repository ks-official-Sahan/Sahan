// Frame of the pre-login pages: no navigation and no site chrome. `admin-root`
// gives the page the admin scrollbars and background (app/admin/admin.css).
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="admin-root flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <main id="admin-main" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
