
export default function BotaoExportar({ callback, label }) {

  return (
    <button onClick={callback}>{label}</button>
  );
}
