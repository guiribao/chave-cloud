type MinicardItem = {
  quantidade?: string | number;
  label: string;
  icon: string;
  classes?: string;
  callback?: () => void;
};

interface MinicardsProps {
  cards: MinicardItem[];
  role?: string;
}

export default function Minicards({ cards, role }: MinicardsProps) {

  // Minicards deve ser um componente universal
  // Criar objeto data em dashboard com os seguintes campos
  // quantidade, label, icon

  return (
    <div className='minicards' data-role={role}>
      {cards.map((card) => (
        <div className={`card-single ${card.classes}`} key={card.label} onClick={card.callback}>
          <div>
            <h1>{card.quantidade || 0}</h1>
            <span>{card.label}</span>
          </div>
          <div>
            <span className={`${card.icon}`}></span>
          </div>
        </div>
      ))}
    </div>
  );
}
