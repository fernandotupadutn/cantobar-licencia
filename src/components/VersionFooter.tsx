import packageJson from '../../package.json';

export default function VersionFooter() {
  return (
    <footer className="fixed bottom-1 right-3 z-[70] select-none pointer-events-none">
      <p className="text-[11px] font-medium text-zinc-400">
        CantoBar POS · v{packageJson.version}
      </p>
    </footer>
  );
}