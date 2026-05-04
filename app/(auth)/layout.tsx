export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-[#E4DFD4] px-4 py-10">
      <div className="w-full max-w-[430px]">{children}</div>
    </div>
  );
}
