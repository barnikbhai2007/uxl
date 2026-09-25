import { Team } from './types';

export const TEAMS_LIST = [
  "AYUSH", "SOUMAJIT", "ARYAN", "SONU", "RANAJAY", "SAMRIDDHA", 
  "RAJAT", "BARNIK", "PRITAM", "DIBYAJOTI", "PRIYAM", "SAGNIK", 
  "SAGNICK", "ABHROJEET", "SAYANTAN", "ANIMESH"
];

export const TEAM_DETAILS: Record<string, { fcName: string, uid: string, ovr: number, fullName: string, goalkeeper: string }> = {
  "AYUSH": { fcName: "AYUSH_08", uid: "847857761683775488", ovr: 121, fullName: "Ayush Saha", goalkeeper: "Joan Garcia" },
  "SOUMAJIT": { fcName: "soubiswas2", uid: "910022838300041217", ovr: 121, fullName: "Soumajit Biswas", goalkeeper: "Buffon" },
  "ARYAN": { fcName: "Baby_Aryanrox121", uid: "908741022842437637", ovr: 119, fullName: "Aryan Sarkar", goalkeeper: "Yashin" },
  "SONU": { fcName: "sonu2007", uid: "545136672475017216", ovr: 119, fullName: "Sonu Mandal", goalkeeper: "Courtois" },
  "RANAJAY": { fcName: "GamerR", uid: "666275283639996417", ovr: 121, fullName: "RANAJOY BHOWMIK", goalkeeper: "Cech" },
  "SAMRIDDHA": { fcName: "sam1017", uid: "1000129435803713536", ovr: 121, fullName: "Samriddha Mandal", goalkeeper: "Dudek" },
  "RAJAT": { fcName: "rd10", uid: "842718468706385920", ovr: 121, fullName: "Rajat Das", goalkeeper: "Savic" },
  "BARNIK": { fcName: "brokenaqua", uid: "858045300533792768", ovr: 121, fullName: "Barnik", goalkeeper: "Donnarumma" },
  "PRITAM": { fcName: "Pritam", uid: "1058620361900937216", ovr: 120, fullName: "Pritam ghosh", goalkeeper: "Bounou" },
  "DIBYAJOTI": { fcName: "dibya7334", uid: "998821168026656769", ovr: 121, fullName: "Dibyajyoti Sarkar", goalkeeper: "Muselera" },
  "PRIYAM": { fcName: "Priyam2007 ⭐", uid: "713327705700397056", ovr: 120, fullName: "Priyam Paul ⭐", goalkeeper: "Courtois" },
  "SAGNIK": { fcName: "Kundes", uid: "1031556959882035200", ovr: 119, fullName: "Sagnik Kundu", goalkeeper: "Robert Sanchez" },
  "SAGNICK": { fcName: "AYU45", uid: "881759190897385472", ovr: 116, fullName: "Sagnick Roy", goalkeeper: "Savic" },
  "ABHROJEET": { fcName: "Abhrojeet", uid: "1000048169385328640", ovr: 115, fullName: "Abhrojeet Kundu", goalkeeper: "Savic" },
  "SAYANTAN": { fcName: "Sayantan111", uid: "1044989674656509952", ovr: 117, fullName: "Sayantan Paul", goalkeeper: "Cech" },
  "ANIMESH": { fcName: "Ashish..Won", uid: "646962951897718784", ovr: 119, fullName: "Animesh", goalkeeper: "Courtois" }
};

export const MANAGERS_LIST = [
  { name: 'Pep Guardiola', flag: '🇪🇸', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Josep_Guardiola_2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2797_%28cropped%29.jpg/500px-Josep_Guardiola_2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2797_%28cropped%29.jpg' },
  { name: 'Carlo Ancelotti', flag: '🇮🇹', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Carlo_Ancelotti_Brazil_V_Morocco_13_June_2026-47.jpg/500px-Carlo_Ancelotti_Brazil_V_Morocco_13_June_2026-47.jpg' },
  { name: 'Jürgen Klopp', flag: '🇩🇪', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/2022-07-21_Fu%C3%9Fball%2C_M%C3%A4nner%2CFreundschaftsspiel%2C_RB_Leipzig_-_FC_Liverpool_1DX_2243_by_Stepro_%28cropped%29_%28cropped%29.jpg/500px-2022-07-21_Fu%C3%9Fball%2C_M%C3%A4nner%2CFreundschaftsspiel%2C_RB_Leipzig_-_FC_Liverpool_1DX_2243_by_Stepro_%28cropped%29_%28cropped%29.jpg' },
  { name: 'Sir Alex Ferguson', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Alex_Ferguson_2012.jpg' },
  { name: 'José Mourinho', flag: '🇵🇹', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Jos%C3%A9_Mourinho_20250206_%281%29.jpg/500px-Jos%C3%A9_Mourinho_20250206_%281%29.jpg' },
  { name: 'Zinedine Zidane', flag: '🇫🇷', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg' },
  { name: 'Arsène Wenger', flag: '🇫🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Ars%C3%A8ne_Wenger_-_240422_192850_%28cropped%29.jpg/500px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Ars%C3%A8ne_Wenger_-_240422_192850_%28cropped%29.jpg' },
  { name: 'Diego Simeone', flag: '🇦🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Diego_Simeone_-_240422_192621-2_%28cropped%29.jpg/500px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Diego_Simeone_-_240422_192621-2_%28cropped%29.jpg' },
  { name: 'Johan Cruyff', flag: '🇳🇱', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Johan_Cruijff_%281974%29.jpg/500px-Johan_Cruijff_%281974%29.jpg' },
  { name: 'Marcello Lippi', flag: '🇮🇹', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Marcello_Lippi_at_China-Iran_press_conference_20190123.jpg' },
  { name: 'Vicente del Bosque', flag: '🇪🇸', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Vicente_del_Bosque_Euro_2012_final.jpg' },
  { name: 'Antonio Conte', flag: '🇮🇹', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/20150616_Antonio_Conte.jpg/500px-20150616_Antonio_Conte.jpg' },
  { name: 'Thomas Tuchel', flag: '🇩🇪', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Thomas_Tuchel_England_v_Ghana_23_June_2026-081.jpg/500px-Thomas_Tuchel_England_v_Ghana_23_June_2026-081.jpg' },
  { name: 'Xabi Alonso', flag: '🇪🇸', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Los_Caminos_del_f%C3%BAtbol._Xabi_Alonso_%2839666778464%29_%28cropped%29.jpg' },
  { name: 'Lionel Scaloni', flag: '🇦🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Lionel_Scaloni_Argentina_v_Spain_19_July_2026-239_%28cropped%29.jpg/500px-Lionel_Scaloni_Argentina_v_Spain_19_July_2026-239_%28cropped%29.jpg' },
  { name: 'Marcelo Bielsa', flag: '🇦🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Marcelo_Bielsa_2018_%28cropped%29.jpg/500px-Marcelo_Bielsa_2018_%28cropped%29.jpg' },
  { name: 'Mikel Arteta', flag: '🇪🇸', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Mikel_Arteta_2021_%28cropped%29.png/500px-Mikel_Arteta_2021_%28cropped%29.png' },
  { name: 'Mauricio Pochettino', flag: '🇦🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Mauricio_Pochettino_USMNT_v_Belgium_Mar_28_2026-2.jpg/500px-Mauricio_Pochettino_USMNT_v_Belgium_Mar_28_2026-2.jpg' },
  { name: 'Unai Emery', flag: '🇪🇸', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Unai_Emery_-_Sevilla_%28cropped%29.jpg/500px-Unai_Emery_-_Sevilla_%28cropped%29.jpg' },
  { name: 'Louis van Gaal', flag: '🇳🇱', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/09/Louis_van_Gaal_2014.jpg' },
  { name: 'Roberto Mancini', flag: '🇮🇹', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Roberto_Mancini_Saudi_Arabia-South_Korea_match_2023_AFC_Asian_Cup.jpg' },
  { name: 'Hansi Flick', flag: '🇩🇪', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/2022_Hansi_Flick_%28cropped%29.jpg/500px-2022_Hansi_Flick_%28cropped%29.jpg' },
  { name: 'Julian Nagelsmann', flag: '🇩🇪', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Julian_Nagelsmann_Ecuador_v_Germany_25_June_2026-047_%283x4_close-up_cropped%29.jpg/500px-Julian_Nagelsmann_Ecuador_v_Germany_25_June_2026-047_%283x4_close-up_cropped%29.jpg' },
  { name: 'Erik ten Hag', flag: '🇳🇱', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D0%B0%D1%8F_%D1%82%D1%80%D0%B5%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0_%C2%AB%D0%90%D1%8F%D0%BA%D1%81%D0%B0%C2%BB_%D0%BF%D0%B5%D1%80%D0%B5%D0%B4_%D0%BC%D0%B0%D1%82%D1%87%D0%B5%D0%BC_%D1%81_%C2%AB%D0%94%D0%B8%D0%BD%D0%B0%D0%BC%D0%BE%C2%BB._27_%D0%B0%D0%B2%D0%B3%D1%83%D1%81%D1%82%D0%B0_2018_%D0%B3%D0%BE%D0%B4%D0%B0_%E2%80%94_900304_%28Erik_ten_Hag%29.jpg' },
  { name: 'Massimiliano Allegri', flag: '🇮🇹', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Incontro_con_le_squadre_finaliste_della_Coppa_Italia_di_calcio_Frecciarossa_Atalanta_-_Juventus_01_-_Massimiliano_Allegri_%28cropped%29.jpg' },
  { name: 'Luiz Felipe Scolari', flag: '🇧🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Felip%C3%A3o_cropped.jpg/500px-Felip%C3%A3o_cropped.jpg' },
  { name: 'Didier Deschamps', flag: '🇫🇷', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Didier_Deschamps_France_v_Senegal_16_June_2026-294.jpg/500px-Didier_Deschamps_France_v_Senegal_16_June_2026-294.jpg' },
  { name: 'Gareth Southgate', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Southgate_2023.jpg/500px-Southgate_2023.jpg' },
  { name: 'Ralf Rangnick', flag: '🇩🇪', photoUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/2022-07-30_Fu%C3%9Fball%2C_M%C3%A4nner%2C_DFL-Supercup%2C_RB_Leipzig_-_FC_Bayern_M%C3%BCnchen_1DX_3148_by_Stepro.jpg/500px-2022-07-30_Fu%C3%9Fball%2C_M%C3%A4nner%2C_DFL-Supercup%2C_RB_Leipzig_-_FC_Bayern_M%C3%BCnchen_1DX_3148_by_Stepro.jpg' },
  { name: 'Claudio Ranieri', flag: '🇮🇹', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Ranieri2023_%28cropped%29.png' }
];

export interface PremierLeagueClub {
  name: string;
  shortName: string;
  flag: string;
  logoUrl: string;
  stadium: string;
  primaryColor: string;
  manager: string;
  managerFlag: string;
  managerNationality: string;
  managerPhoto: string;
}

export const PREMIER_LEAGUE_TEAMS: PremierLeagueClub[] = [
  { 
    name: 'Arsenal', 
    shortName: 'ARS', 
    flag: '🔴', 
    logoUrl: 'https://crests.football-data.org/57.png', 
    stadium: 'Emirates Stadium', 
    primaryColor: '#EF0107',
    manager: 'Mikel Arteta',
    managerFlag: '🇪🇸',
    managerNationality: 'Spain',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Mikel_Arteta_2021_%28cropped%29.png/500px-Mikel_Arteta_2021_%28cropped%29.png'
  },
  { 
    name: 'Aston Villa', 
    shortName: 'AVL', 
    flag: '🦁', 
    logoUrl: 'https://crests.football-data.org/58.png', 
    stadium: 'Villa Park', 
    primaryColor: '#670E36',
    manager: 'Unai Emery',
    managerFlag: '🇪🇸',
    managerNationality: 'Spain',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Unai_Emery_-_Sevilla_%28cropped%29.jpg/500px-Unai_Emery_-_Sevilla_%28cropped%29.jpg'
  },
  { 
    name: 'AFC Bournemouth', 
    shortName: 'BOU', 
    flag: '🍒', 
    logoUrl: 'https://crests.football-data.org/1044.png', 
    stadium: 'Vitality Stadium', 
    primaryColor: '#DA291C',
    manager: 'Andoni Iraola',
    managerFlag: '🇪🇸',
    managerNationality: 'Spain',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Andoni_Iraola_in_a_press_conference_for_AFC_Bournemouth%2C_2026_%28cropped%29.webp/500px-Andoni_Iraola_in_a_press_conference_for_AFC_Bournemouth%2C_2026_%28cropped%29.webp'
  },
  { 
    name: 'Brentford', 
    shortName: 'BRE', 
    flag: '🐝', 
    logoUrl: 'https://crests.football-data.org/402.png', 
    stadium: 'Gtech Community Stadium', 
    primaryColor: '#E30613',
    manager: 'Thomas Frank',
    managerFlag: '🇩🇰',
    managerNationality: 'Denmark',
    managerPhoto: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Thomas_Frank_%28cropped%29.jpeg'
  },
  { 
    name: 'Brighton & Hove Albion', 
    shortName: 'BHA', 
    flag: '🕊️', 
    logoUrl: 'https://crests.football-data.org/397.png', 
    stadium: 'Amex Stadium', 
    primaryColor: '#0057B8',
    manager: 'Fabian Hürzeler',
    managerFlag: '🇩🇪',
    managerNationality: 'Germany',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Fabian_H%C3%BCrzeler_24012026_%288%29.jpg/500px-Fabian_H%C3%BCrzeler_24012026_%288%29.jpg'
  },
  { 
    name: 'Chelsea', 
    shortName: 'CHE', 
    flag: '🔵', 
    logoUrl: 'https://crests.football-data.org/61.png', 
    stadium: 'Stamford Bridge', 
    primaryColor: '#034694',
    manager: 'Enzo Maresca',
    managerFlag: '🇮🇹',
    managerNationality: 'Italy',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Enzo_maresca_chelsea_gent_2024_%28extracted%29.jpg/500px-Enzo_maresca_chelsea_gent_2024_%28extracted%29.jpg'
  },
  { 
    name: 'Crystal Palace', 
    shortName: 'CRY', 
    flag: '🦅', 
    logoUrl: 'https://crests.football-data.org/354.png', 
    stadium: 'Selhurst Park', 
    primaryColor: '#1B458F',
    manager: 'Oliver Glasner',
    managerFlag: '🇦🇹',
    managerNationality: 'Austria',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/2022128173931_2022-05-08_Fussball_Eintracht_Frankfurt_vs_Borussia_M%C3%B6nchengladbach_-_Sven_-_1D_X_MK_II_-_2395_-_B70I8506_%28cropped%29.jpg/500px-2022128173931_2022-05-08_Fussball_Eintracht_Frankfurt_vs_Borussia_M%C3%B6nchengladbach_-_Sven_-_1D_X_MK_II_-_2395_-_B70I8506_%28cropped%29.jpg'
  },
  { 
    name: 'Everton', 
    shortName: 'EVE', 
    flag: '🍬', 
    logoUrl: 'https://crests.football-data.org/62.png', 
    stadium: 'Goodison Park', 
    primaryColor: '#003399',
    manager: 'Sean Dyche',
    managerFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    managerNationality: 'England',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Sean_Dyche_-_Toffee_TV_EFC.png/500px-Sean_Dyche_-_Toffee_TV_EFC.png'
  },
  { 
    name: 'Fulham', 
    shortName: 'FUL', 
    flag: '⚪', 
    logoUrl: 'https://crests.football-data.org/63.png', 
    stadium: 'Craven Cottage', 
    primaryColor: '#000000',
    manager: 'Marco Silva',
    managerFlag: '🇵🇹',
    managerNationality: 'Portugal',
    managerPhoto: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Marco_Silva_20042025_%282%29_%28cropped%29.jpg'
  },
  { 
    name: 'Ipswich Town', 
    shortName: 'IPS', 
    flag: '🚜', 
    logoUrl: 'https://crests.football-data.org/349.png', 
    stadium: 'Portman Road', 
    primaryColor: '#00448A',
    manager: 'Kieran McKenna',
    managerFlag: '🇬🇧',
    managerNationality: 'Northern Ireland',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Kieran_McKenna_Crop.jpg/500px-Kieran_McKenna_Crop.jpg'
  },
  { 
    name: 'Leicester City', 
    shortName: 'LEI', 
    flag: '🦊', 
    logoUrl: 'https://crests.football-data.org/338.png', 
    stadium: 'King Power Stadium', 
    primaryColor: '#003090',
    manager: 'Steve Cooper',
    managerFlag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    managerNationality: 'Wales',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Steve_Cooper.jpg/500px-Steve_Cooper.jpg'
  },
  { 
    name: 'Liverpool', 
    shortName: 'LIV', 
    flag: '🔴', 
    logoUrl: 'https://crests.football-data.org/64.png', 
    stadium: 'Anfield', 
    primaryColor: '#C8102E',
    manager: 'Arne Slot',
    managerFlag: '🇳🇱',
    managerNationality: 'Netherlands',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Arne_Slot_in_2024.jpg/500px-Arne_Slot_in_2024.jpg'
  },
  { 
    name: 'Manchester City', 
    shortName: 'MCI', 
    flag: '🩵', 
    logoUrl: 'https://crests.football-data.org/65.png', 
    stadium: 'Etihad Stadium', 
    primaryColor: '#6CABDD',
    manager: 'Pep Guardiola',
    managerFlag: '🇪🇸',
    managerNationality: 'Spain',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Josep_Guardiola_2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2797_%28cropped%29.jpg/500px-Josep_Guardiola_2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2797_%28cropped%29.jpg'
  },
  { 
    name: 'Manchester United', 
    shortName: 'MUN', 
    flag: '👹', 
    logoUrl: 'https://crests.football-data.org/66.png', 
    stadium: 'Old Trafford', 
    primaryColor: '#DA291C',
    manager: 'Ruben Amorim',
    managerFlag: '🇵🇹',
    managerNationality: 'Portugal',
    managerPhoto: 'https://upload.wikimedia.org/wikipedia/commons/3/37/RubenAmorim4.png'
  },
  { 
    name: 'Newcastle United', 
    shortName: 'NEW', 
    flag: '⚪', 
    logoUrl: 'https://crests.football-data.org/67.png', 
    stadium: "St. James' Park", 
    primaryColor: '#241F20',
    manager: 'Eddie Howe',
    managerFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    managerNationality: 'England',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Eddie_Howe_24052026_%281%29.jpg/500px-Eddie_Howe_24052026_%281%29.jpg'
  },
  { 
    name: 'Nottingham Forest', 
    shortName: 'NFO', 
    flag: '🌳', 
    logoUrl: 'https://crests.football-data.org/351.png', 
    stadium: 'City Ground', 
    primaryColor: '#DD0000',
    manager: 'Nuno Espírito Santo',
    managerFlag: '🇵🇹',
    managerNationality: 'Portugal',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Nuno_Esp%C3%ADrito_Santo_%28cropped%29.jpg/500px-Nuno_Esp%C3%ADrito_Santo_%28cropped%29.jpg'
  },
  { 
    name: 'Southampton', 
    shortName: 'SOU', 
    flag: '🔴', 
    logoUrl: 'https://crests.football-data.org/340.png', 
    stadium: "St. Mary's Stadium", 
    primaryColor: '#D71920',
    manager: 'Russell Martin',
    managerFlag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    managerNationality: 'Scotland',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Russell_Martin_2019.jpg/500px-Russell_Martin_2019.jpg'
  },
  { 
    name: 'Tottenham Hotspur', 
    shortName: 'TOT', 
    flag: '⚪', 
    logoUrl: 'https://crests.football-data.org/73.png', 
    stadium: 'Tottenham Hotspur Stadium', 
    primaryColor: '#132257',
    manager: 'Ange Postecoglou',
    managerFlag: '🇦🇺',
    managerNationality: 'Australia',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Ange_Postecoglou_%28cropped%29.jpg/500px-Ange_Postecoglou_%28cropped%29.jpg'
  },
  { 
    name: 'West Ham United', 
    shortName: 'WHU', 
    flag: '⚒️', 
    logoUrl: 'https://crests.football-data.org/563.png', 
    stadium: 'London Stadium', 
    primaryColor: '#7A263A',
    manager: 'Julen Lopetegui',
    managerFlag: '🇪🇸',
    managerNationality: 'Spain',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Julen_Lopetegui_Canada_v_Qatar_18_June_2026-056_%28cropped%29.jpg/500px-Julen_Lopetegui_Canada_v_Qatar_18_June_2026-056_%28cropped%29.jpg'
  },
  { 
    name: 'Wolverhampton Wanderers', 
    shortName: 'WOL', 
    flag: '🐺', 
    logoUrl: 'https://crests.football-data.org/76.png', 
    stadium: 'Molineux Stadium', 
    primaryColor: '#FDB913',
    manager: "Gary O'Neil",
    managerFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    managerNationality: 'England',
    managerPhoto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/GON_220826.jpg/500px-GON_220826.jpg'
  }
];

export const getClubManager = (clubNameOrManager: string | undefined): PremierLeagueClub | null => {
  if (!clubNameOrManager) return null;
  const norm = clubNameOrManager.replace(/⭐/g, '').trim().toLowerCase();
  return PREMIER_LEAGUE_TEAMS.find(c => 
    c.name.toLowerCase() === norm || 
    c.shortName.toLowerCase() === norm ||
    c.manager.toLowerCase() === norm
  ) || null;
};

export const PL_TEAMS = PREMIER_LEAGUE_TEAMS;
export const WORLD_CUP_TEAMS = PREMIER_LEAGUE_TEAMS;

export const INITIAL_TEAMS: Team[] = TEAMS_LIST.map((name, index) => {
  const details = TEAM_DETAILS[name];
  return {
    id: `team-${index}`,
    name: name, // Keep short name as 'name' for matching
    shortName: name,
    fullName: details?.fullName || name,
    fcName: details?.fcName || "",
    ovr: details?.ovr || 0,
    uid: details?.uid || "",
    goalkeeper: details?.goalkeeper || "",
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    form: [],
  };
});

export interface RawMatch {
  away: string;
  home: string;
  matchday: number;
  type?: 'qualifier' | 'quarterfinal' | 'semifinal' | 'thirdplace' | 'final';
  rescheduled?: boolean;
  matchNumber?: number;
  leg?: 'Leg 1' | 'Leg 2';
}

export const TOURNAMENT_SCHEDULE: RawMatch[] = [
  // Matchday 1 - 27th March
  { away: "RAJAT", home: "SAMRIDDHA", matchday: 1 },
  { away: "ARYAN", home: "SONU", matchday: 1 },
  { away: "SAMRIDDHA", home: "SOUMAJIT", matchday: 1 },
  { away: "SONU", home: "SOUMAJIT", matchday: 1 },
  { away: "PRIYAM", home: "SAGNICK", matchday: 1 },
  { away: "DIBYAJOTI", home: "SAGNIK", matchday: 1 },
  { away: "AYUSH", home: "PRITAM", matchday: 1 },
  { away: "PRIYAM", home: "SAGNIK", matchday: 1 },
  { away: "ANIMESH", home: "SAYANTAN", matchday: 1 },
  { away: "ABHROJEET", home: "AYUSH", matchday: 1 },
  { away: "DIBYAJOTI", home: "PRITAM", matchday: 1 },
  { away: "ANIMESH", home: "SAGNICK", matchday: 1 },
  { away: "ABHROJEET", home: "SAYANTAN", matchday: 1 },
  { away: "ARYAN", home: "RANAJAY", matchday: 1 },
  { away: "RAJAT", home: "BARNIK", matchday: 1 },
  { away: "RANAJAY", home: "BARNIK", matchday: 1 },

  // Matchday 2 - 28th March
  { away: "BARNIK", home: "SAYANTAN", matchday: 2 },
  { away: "RAJAT", home: "RANAJAY", matchday: 3, rescheduled: true },
  { away: "ABHROJEET", home: "SAMRIDDHA", matchday: 2 },
  { away: "SAGNIK", home: "SOUMAJIT", matchday: 2 },
  { away: "PRITAM", home: "SAGNIK", matchday: 2 },
  { away: "ABHROJEET", home: "ANIMESH", matchday: 2 },
  { away: "PRIYAM", home: "RANAJAY", matchday: 3, rescheduled: true },
  { away: "AYUSH", home: "PRIYAM", matchday: 2 },
  { away: "DIBYAJOTI", home: "RAJAT", matchday: 2 },
  { away: "DIBYAJOTI", home: "SOUMAJIT", matchday: 2 },
  { away: "SAMRIDDHA", home: "SONU", matchday: 2 },
  { away: "PRITAM", home: "SAGNICK", matchday: 2 },
  { away: "AYUSH", home: "SAGNICK", matchday: 2 },
  { away: "ARYAN", home: "BARNIK", matchday: 2 },
  { away: "ARYAN", home: "SAYANTAN", matchday: 2 },
  { away: "ANIMESH", home: "SONU", matchday: 2 },

  // Matchday 3 - 29th March
  { away: "SAYANTAN", home: "RANAJAY", matchday: 3 },
  { away: "ABHROJEET", home: "SAGNICK", matchday: 3 },
  { away: "AYUSH", home: "RANAJAY", matchday: 3 },
  { away: "ABHROJEET", home: "SONU", matchday: 3 },
  { away: "ARYAN", home: "SOUMAJIT", matchday: 3 },
  { away: "ARYAN", home: "SAGNICK", matchday: 3 },
  { away: "ANIMESH", home: "DIBYAJOTI", matchday: 3 },
  { away: "BARNIK", home: "SAGNIK", matchday: 3 },
  { away: "DIBYAJOTI", home: "SONU", matchday: 3 },
  { away: "ANIMESH", home: "SAMRIDDHA", matchday: 3 },
  { away: "PRITAM", home: "PRIYAM", matchday: 3 },
  { away: "SAGNIK", home: "SAMRIDDHA", matchday: 3 },
  { away: "SOUMAJIT", home: "BARNIK", matchday: 3 },
  { away: "PRITAM", home: "RAJAT", matchday: 3 },
  { away: "PRIYAM", home: "SAYANTAN", matchday: 3 },
  { away: "AYUSH", home: "RAJAT", matchday: 3 },

  // Matchday 4 - 30th March (Ongoing)
  { away: "AYUSH", home: "SOUMAJIT", matchday: 4 },
  { away: "BARNIK", home: "PRIYAM", matchday: 4 },
  { away: "RANAJAY", home: "SAMRIDDHA", matchday: 4 },
  { away: "ANIMESH", home: "SAGNIK", matchday: 4 },
  { away: "ARYAN", home: "PRITAM", matchday: 4 },
  { away: "SAYANTAN", home: "SOUMAJIT", matchday: 4 },
  { away: "ABHROJEET", home: "PRITAM", matchday: 4 },
  { away: "AYUSH", home: "SONU", matchday: 4 },
  { away: "DIBYAJOTI", home: "PRIYAM", matchday: 4 },
  { away: "ABHROJEET", home: "RAJAT", matchday: 4 },
  { away: "RAJAT", home: "SONU", matchday: 4 },
  { away: "DIBYAJOTI", home: "SAMRIDDHA", matchday: 4 },
  { away: "ARYAN", home: "SAGNIK", matchday: 4 },
  { away: "ANIMESH", home: "BARNIK", matchday: 4 },
  { away: "RANAJAY", home: "SAGNICK", matchday: 4 },
  { away: "SAGNICK", home: "SAYANTAN", matchday: 4 },
  { away: "DIBYAJOTI", home: "SAYANTAN", matchday: 4 },
  { away: "ABHROJEET", home: "SAGNIK", matchday: 4 },
  { away: "ANIMESH", home: "SOUMAJIT", matchday: 4 },
  { away: "RAJAT", home: "SAGNICK", matchday: 4 },
  { away: "ARYAN", home: "AYUSH", matchday: 4 },
  { away: "BARNIK", home: "SAMRIDDHA", matchday: 4 },
  { away: "PRITAM", home: "RANAJAY", matchday: 4 },
  { away: "PRIYAM", home: "SONU", matchday: 4 },

  // Matchday 5 - 31st March (Qualifiers & Quarterfinals)
  { away: "ANIMESH", home: "BARNIK", matchday: 5, type: 'qualifier', matchNumber: 73, leg: 'Leg 1' },
  { away: "RAJAT", home: "RANAJAY", matchday: 5, type: 'qualifier', matchNumber: 74, leg: 'Leg 1' },
  { away: "SONU", home: "SAGNIK", matchday: 5, type: 'qualifier', matchNumber: 75, leg: 'Leg 1' },
  { away: "AYUSH", home: "SOUMAJIT", matchday: 5, type: 'qualifier', matchNumber: 76, leg: 'Leg 1' },
  { away: "BARNIK", home: "ANIMESH", matchday: 5, type: 'qualifier', matchNumber: 77, leg: 'Leg 2' },
  { away: "RANAJAY", home: "RAJAT", matchday: 5, type: 'qualifier', matchNumber: 78, leg: 'Leg 2' },
  { away: "SAGNIK", home: "SONU", matchday: 5, type: 'qualifier', matchNumber: 79, leg: 'Leg 2' },
  { away: "SOUMAJIT", home: "AYUSH", matchday: 5, type: 'qualifier', matchNumber: 80, leg: 'Leg 2' },

  { away: "ARYAN", home: "BARNIK", matchday: 5, type: 'quarterfinal', matchNumber: 81, leg: 'Leg 1' },
  { away: "PRIYAM", home: "RANAJAY", matchday: 5, type: 'quarterfinal', matchNumber: 82, leg: 'Leg 1' },
  { away: "PRITAM", home: "SONU", matchday: 5, type: 'quarterfinal', matchNumber: 83, leg: 'Leg 1' },
  { away: "SAMRIDDHA", home: "TBD", matchday: 5, type: 'quarterfinal', matchNumber: 84, leg: 'Leg 1' },
  { away: "BARNIK", home: "ARYAN", matchday: 5, type: 'quarterfinal', matchNumber: 85, leg: 'Leg 2' },
  { away: "RANAJAY", home: "PRIYAM", matchday: 5, type: 'quarterfinal', matchNumber: 86, leg: 'Leg 2' },
  { away: "SONU", home: "PRITAM", matchday: 5, type: 'quarterfinal', matchNumber: 87, leg: 'Leg 2' },
  { away: "TBD", home: "SAMRIDDHA", matchday: 5, type: 'quarterfinal', matchNumber: 88, leg: 'Leg 2' },

  // Matchday 6 - 1st April (Semis, 3rd Place & Final)
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 89, leg: 'Leg 1' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 90, leg: 'Leg 1' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 91, leg: 'Leg 2' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 92, leg: 'Leg 2' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'thirdplace', matchNumber: 93 },
  { away: "TBD", home: "TBD", matchday: 6, type: 'final', matchNumber: 94 },
];
