import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Snapdesk Business Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your menu, availability, and WhatsApp orders.
        </p>
      </div>
      <LoginForm justCreated={created === "1"} />
    </main>
  );
}
