// Conteúdo do jogo: fases, paradas (objetos com que o personagem interage), skills e links.
// É a fonte única de texto, usada tanto pelo jogo quanto pelo SVG do README.

export const LINKS = {
  game: 'https://carloszeyy.github.io/CarlosZeyy/',
  github: 'https://github.com/CarlosZeyy',
  linkedin: 'https://www.linkedin.com/in/carlosmoisesdev/',
  portfolio: 'https://carlosmoises.dev',
  email: 'mailto:carlosmoisesdev@gmail.com',
};

export const ZONES = [{ name: 'ORIGEM' }, { name: 'SKILLS' }, { name: 'PROJETOS' }, { name: 'CONTATO' }];

// zone: índice da fase; dx: posição dentro da fase; kind: como o objeto é desenhado (world.js);
// rows: linhas [rótulo, valor] do painel SYSTEM.INFO; link: aberto com [E] no jogo;
// demo: o SVG do README para nesta parada.
export const STOPS = [
  {
    id: 'sobre', zone: 0, dx: 150, kind: 'sign', label: 'SOBRE', title: 'SUBJECT', demo: true,
    rows: [
      ['SUBJECT', 'Carlos Moises'],
      ['ROLE', 'Full-Stack Developer & Analista de Sistemas'],
      ['ORIGIN', 'Santo André, SP, Brasil'],
    ],
  },
  {
    id: 'systelos', zone: 0, dx: 350, kind: 'building', label: 'SYSTELOS', title: 'WORK',
    rows: [
      ['COMPANY', 'Systelos'],
      ['ROLE', 'Desenvolvedor Full Stack & Analista de Sistemas'],
      ['STACK', 'Next.js, NestJS, Node.js, SQL, Prisma'],
    ],
  },
  {
    id: 'estacio', zone: 0, dx: 500, kind: 'building', label: 'ESTÁCIO', title: 'EDUCATION',
    rows: [
      ['COURSE', 'Tecnólogo em ADS'],
      ['SCHOOL', 'Estácio'],
      ['PERIOD', '2025 – 2027'],
    ],
  },
  {
    id: 'code', zone: 1, dx: 150, kind: 'terminal', label: 'CODE', title: 'CORE', demo: true,
    rows: [
      ['CORE.LANG', 'TypeScript, JavaScript, Java, SQL'],
      ['CORE.FRONTEND', 'React, Next.js, Vite, Tailwind CSS'],
      ['CORE.BACKEND', 'Node.js, NestJS, Express, Spring Boot, REST'],
    ],
  },
  {
    id: 'data', zone: 1, dx: 340, kind: 'terminal', label: 'DATA', title: 'DATA & INFRA',
    rows: [
      ['CORE.DATABASE', 'PostgreSQL, Prisma, Supabase, MySQL, MongoDB'],
      ['CORE.INFRA', 'Docker, GitHub Actions, Azure, Linux, Vercel'],
    ],
  },
  {
    id: 'tools', zone: 1, dx: 520, kind: 'terminal', label: 'TOOLS', title: 'TOOLCHAIN',
    rows: [['TOOLCHAIN', 'VS Code, Git, Docker, Jest, Postman, Jira']],
  },
  {
    id: 'enfermex', zone: 2, dx: 92, kind: 'building', label: 'ENFERMEX', title: 'PROJECT', demo: true,
    rows: [
      ['PROJECT', 'Enfermex — gestão de pacientes'],
      ['IMPACT', 'Prontuário: de 20 para 5 min por paciente'],
      ['STACK', 'Java, Spring Boot, PostgreSQL, React'],
    ],
    link: { label: 'CÓDIGO', url: 'https://github.com/CarlosZeyy/EnfermEX' },
  },
  {
    id: 'mvvidros', zone: 2, dx: 232, kind: 'building', label: 'MV VIDROS', title: 'PROJECT', demo: true,
    rows: [
      ['PROJECT', 'Sistema de Orçamentos — MV Vidros'],
      ['IMPACT', 'Orçamento em PDF: de 30 para 5 minutos'],
      ['STACK', 'Next.js, TypeScript, Puppeteer, Docker'],
    ],
    link: { label: 'CÓDIGO', url: 'https://github.com/CarlosZeyy/Sistema-MvVidros' },
  },
  {
    id: 'calculadora', zone: 2, dx: 372, kind: 'building', label: 'CALCULADORA', title: 'PROJECT',
    rows: [
      ['PROJECT', 'Calculadora de Investimentos'],
      ['ABOUT', 'Juros compostos com gráfico em tempo real'],
      ['STACK', 'JavaScript, Tailwind CSS, Chart.js'],
    ],
    link: { label: 'DEMO', url: 'https://calcinvestimentos.netlify.app/' },
  },
  {
    id: 'spotify', zone: 2, dx: 512, kind: 'building', label: 'SPOTIFY CLONE', title: 'PROJECT',
    rows: [
      ['PROJECT', 'Clone do Spotify'],
      ['ABOUT', 'Player funcional e navegação entre páginas'],
      ['STACK', 'React, Node.js, Express'],
    ],
    link: { label: 'DEMO', url: 'https://frontend-spotify-clone-sepia.vercel.app' },
  },
  {
    id: 'linkedin', zone: 3, dx: 60, kind: 'billboard', label: 'LINKEDIN', title: 'CONTACT',
    rows: [['GRID.LINKEDIN', 'in/carlosmoisesdev']],
    link: { label: 'LINKEDIN', url: LINKS.linkedin },
  },
  {
    id: 'portfolio', zone: 3, dx: 134, kind: 'billboard', label: 'PORTFÓLIO', title: 'CONTACT',
    rows: [['GRID.PORTFOLIO', 'carlosmoises.dev']],
    link: { label: 'PORTFÓLIO', url: LINKS.portfolio },
  },
  {
    id: 'github', zone: 3, dx: 208, kind: 'billboard', label: 'GITHUB', title: 'CONTACT',
    rows: [['GRID.GITHUB', '@CarlosZeyy']],
    link: { label: 'GITHUB', url: LINKS.github },
  },
  {
    id: 'email', zone: 3, dx: 282, kind: 'billboard', label: 'E-MAIL', title: 'CONTACT',
    rows: [['GRID.MAIL', 'carlosmoisesdev@gmail.com']],
    link: { label: 'E-MAIL', url: LINKS.email },
  },
  {
    id: 'antena', zone: 3, dx: 354, kind: 'antenna', label: 'ANTENA', title: 'TRANSMISSION', demo: true, final: true,
    rows: [
      ['STATUS', 'Disponível para novos projetos'],
      ['MSG', 'Tem um problema que vale resolver com código?'],
      ['', 'Me chama.'],
    ],
    // no README não dá para andar até as placas, então a parada final mostra os contatos
    demoRows: [
      ['GRID.MAIL', 'carlosmoisesdev@gmail.com'],
      ['GRID.PORTFOLIO', 'carlosmoises.dev'],
      ['GRID.LINKEDIN', 'in/carlosmoisesdev'],
      ['GRID.GITHUB', '@CarlosZeyy'],
    ],
  },
];

// Chips de skill espalhados pela fase 2. y é o topo do chip; os de y = 146 são pegos só andando,
// os mais altos pedem pulo ou plataforma.
export const CHIPS = [
  { name: 'TypeScript', dx: 70, y: 146 },
  { name: 'JavaScript', dx: 98, y: 146 },
  { name: 'Java', dx: 126, y: 146 },
  { name: 'SQL', dx: 174, y: 92 },
  { name: 'React', dx: 212, y: 102 },
  { name: 'Next.js', dx: 270, y: 64 },
  { name: 'Node.js', dx: 300, y: 146 },
  { name: 'Spring Boot', dx: 388, y: 146 },
  { name: 'Express', dx: 412, y: 102 },
  { name: 'Tailwind', dx: 434, y: 102 },
  { name: 'PostgreSQL', dx: 452, y: 146 },
  { name: 'Docker', dx: 478, y: 146 },
  { name: 'MongoDB', dx: 544, y: 92 },
  { name: 'Git', dx: 576, y: 146 },
];

export const COLS = 60; // caracteres por linha do painel

// Divide uma linha [rótulo, valor] em trechos coloridos: RÓTULO ....... VALOR
export function rowSegments([label, value]) {
  if (!label) return [[value, 'value']];
  const dots = '.'.repeat(Math.max(3, COLS - label.length - value.length - 2));
  return [[label + ' ', 'label'], [dots, 'dots'], [' ' + value, 'value']];
}
