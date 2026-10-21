import { authFetch } from './authFetch';
import type { Question, DiagramFilter } from '../hooks/useQuizGame';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { resolveDiagramUrl } from './resolveDiagramUrl';
import { attachAnswerKeys } from './quizApi';
import { useAuth } from './auth';
import { hasDataTable, formatTableOptionText } from './compilerFilters';
export { resolveDiagramUrl, formatTableOptionText };
export type { Question, DiagramFilter };

export interface SyllabusTopic {
  id: string;
  name: string;
  orderIndex: number;
}

export const CAMBRIDGE_TOPICS: SyllabusTopic[] = [
  {
    id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
    name: 'The basic economic problem',
    orderIndex: 1,
  },
  {
    id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    name: 'The allocation of resources',
    orderIndex: 2,
  },
  {
    id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    name: 'Microeconomic decision makers',
    orderIndex: 3,
  },
  {
    id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    name: 'Government and the macroeconomy',
    orderIndex: 4,
  },
  {
    id: 'c9501184-3e43-4b00-aac5-791638119278',
    name: 'Economic development',
    orderIndex: 5,
  },
  {
    id: '941a998b-8700-47b5-8695-c262070d4949',
    name: 'International trade and globalisation',
    orderIndex: 6,
  },
];

export const CAMBRIDGE_QUESTIONS: Question[] = [
  {
    id: '0455-s24-12-q01',
    stem_markdown: "Why will scarcity always exist?",
    options: [
      { id: '0455-s24-12-q01-opt-a', text_markdown: "There are high costs of production." },
      { id: '0455-s24-12-q01-opt-b', text_markdown: "There are low levels of education." },
      { id: '0455-s24-12-q01-opt-c', text_markdown: "There are unlimited resources." },
      { id: '0455-s24-12-q01-opt-d', text_markdown: "There are unlimited wants." }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q1",
    topic_id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
    topic: "The basic economic problem",
  },
  {
    id: '0455-s24-12-q02',
    stem_markdown: "A student decides to take up a two-year apprenticeship for which she will earn \\$10,000 per year. After that, she expects to earn \\$25,000 per year. She could take an unskilled job which pays \\$16,000 per year instead of the apprenticeship.\n\nWhat is the opportunity cost in the two years of completing the apprenticeship?",
    options: [
      { id: '0455-s24-12-q02-opt-a', text_markdown: "\\$10,000" },
      { id: '0455-s24-12-q02-opt-b', text_markdown: "\\$12,000" },
      { id: '0455-s24-12-q02-opt-c', text_markdown: "\\$25,000" },
      { id: '0455-s24-12-q02-opt-d', text_markdown: "\\$32,000" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q2",
    topic_id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
    topic: "The basic economic problem",
  },
  {
    id: '0455-s24-12-q03',
    stem_markdown: "The diagram shows a country’s production possibility curve (PPC).\n\nWhich current combination of capital and consumer goods would produce the greatest number of consumer goods in the future?",
    options: [
      { id: '0455-s24-12-q03-opt-a', text_markdown: "O and Q" },
      { id: '0455-s24-12-q03-opt-b', text_markdown: "P and O" },
      { id: '0455-s24-12-q03-opt-c', text_markdown: "R and S" },
      { id: '0455-s24-12-q03-opt-d', text_markdown: "U and V" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q3",
    topic_id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
    topic: "The basic economic problem",
    has_diagram: true,
    image_url: "/questions/0455_2024_s_12_q3.png",
  },
  {
    id: '0455-s24-12-q04',
    stem_markdown: "What is not a macroeconomic topic?",
    options: [
      { id: '0455-s24-12-q04-opt-a', text_markdown: "the growth in Chinese Gross Domestic Product" },
      { id: '0455-s24-12-q04-opt-b', text_markdown: "the level of Consumer Prices Index inflation in the UK" },
      { id: '0455-s24-12-q04-opt-c', text_markdown: "the level of unemployment in Spain" },
      { id: '0455-s24-12-q04-opt-d', text_markdown: "the total output of the German car industry" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q4",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q05',
    stem_markdown: "What is likely to cause an extension in demand for a firm’s fruit drink?",
    options: [
      { id: '0455-s24-12-q05-opt-a', text_markdown: "a period of hot weather" },
      { id: '0455-s24-12-q05-opt-b', text_markdown: "a reduction in the cost of producing the drink" },
      { id: '0455-s24-12-q05-opt-c', text_markdown: "a rival firm leaving the market" },
      { id: '0455-s24-12-q05-opt-d', text_markdown: "a successful advertising campaign by the firm" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q5",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q06',
    stem_markdown: "Supermarkets sell petrol (gas) outside their stores. They reduce the price of petrol below other suppliers to attract more customers to buy goods in the store when they buy more petrol.\n\nIf this were successful, how might it be shown on demand and supply diagrams?\n\n| | demand and supply diagram for petrol | demand and supply diagram for the store’s goods |\n| :---: | :--- | :--- |\n| **A** | shift of the demand curve to the left | shift of the supply curve to the left |\n| **B** | shift of the demand curve to the right | shift of the demand curve to the left |\n| **C** | shift of the supply curve to the left | shift of the supply curve to the right |\n| **D** | shift of the supply curve to the right | shift of the demand curve to the right |",
    options: [
      { id: '0455-s24-12-q06-opt-a', text_markdown: "Shift of the demand curve to the left | Shift of the supply curve to the left" },
      { id: '0455-s24-12-q06-opt-b', text_markdown: "Shift of the demand curve to the right | Shift of the demand curve to the left" },
      { id: '0455-s24-12-q06-opt-c', text_markdown: "Shift of the supply curve to the left | Shift of the supply curve to the right" },
      { id: '0455-s24-12-q06-opt-d', text_markdown: "Shift of the supply curve to the right | Shift of the demand curve to the right" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q6",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q07',
    stem_markdown: "Which statement describes a market in disequilibrium?",
    options: [
      { id: '0455-s24-12-q07-opt-a', text_markdown: "Excess demand results from a government maximum price below the equilibrium price." },
      { id: '0455-s24-12-q07-opt-b', text_markdown: "The point where the demand and supply curves cross." },
      { id: '0455-s24-12-q07-opt-c', text_markdown: "Price changes cause further changes in both demand and supply." },
      { id: '0455-s24-12-q07-opt-d', text_markdown: "The quantity demanded by consumers equals the quantity supplied by producers." }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q7",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q08',
    stem_markdown: "In response to an increase in price from \\$5 per kg to \\$6 per kg, a farmer increased supply from 400 kg to 500 kg per week.\n\nWhat is the price elasticity of supply?",
    options: [
      { id: '0455-s24-12-q08-opt-a', text_markdown: "0.8" },
      { id: '0455-s24-12-q08-opt-b', text_markdown: "0.9" },
      { id: '0455-s24-12-q08-opt-c', text_markdown: "1.2" },
      { id: '0455-s24-12-q08-opt-d', text_markdown: "1.25" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q8",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q09',
    stem_markdown: "Which government measure is most likely to cause a fall both in price and in quantity traded?",
    options: [
      { id: '0455-s24-12-q09-opt-a', text_markdown: "indirect tax" },
      { id: '0455-s24-12-q09-opt-b', text_markdown: "maximum price" },
      { id: '0455-s24-12-q09-opt-c', text_markdown: "minimum price" },
      { id: '0455-s24-12-q09-opt-d', text_markdown: "subsidy" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q9",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q10',
    stem_markdown: "The diagrams show the wage rates of cleaners ($OW_c$) and nurses ($OW_n$).\n\nWhat is the result if a national minimum wage of $OM$ is introduced?\n\n| | wage rates of cleaners | wage rates of nurses |\n| :---: | :---: | :---: |\n| **A** | fall | rise |\n| **B** | no change | fall |\n| **C** | rise | fall |\n| **D** | rise | no change |",
    options: [
      { id: '0455-s24-12-q10-opt-a', text_markdown: "Fall | Rise" },
      { id: '0455-s24-12-q10-opt-b', text_markdown: "No change | Fall" },
      { id: '0455-s24-12-q10-opt-c', text_markdown: "Rise | Fall" },
      { id: '0455-s24-12-q10-opt-d', text_markdown: "Rise | No change" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q10",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
    has_diagram: true,
    image_url: "/questions/0455_2024_s_12_q10.png",
  },
  {
    id: '0455-s24-12-q11',
    stem_markdown: "What would cause a decrease in spending by households in a country?",
    options: [
      { id: '0455-s24-12-q11-opt-a', text_markdown: "a reduction in disposable income" },
      { id: '0455-s24-12-q11-opt-b', text_markdown: "a reduction in the rate of sales tax" },
      { id: '0455-s24-12-q11-opt-c', text_markdown: "lower interest rates" },
      { id: '0455-s24-12-q11-opt-d', text_markdown: "lower savings" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q11",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q12',
    stem_markdown: "Which combination shows the advantages of a small firm over a larger firm?\n\n| | better communication | greater independence | lower average cost |\n| :---: | :---: | :---: | :---: |\n| **A** | no | no | yes |\n| **B** | no | yes | no |\n| **C** | yes | yes | no |\n| **D** | yes | yes | yes |",
    options: [
      { id: '0455-s24-12-q12-opt-a', text_markdown: "No | No | Yes" },
      { id: '0455-s24-12-q12-opt-b', text_markdown: "No | Yes | No" },
      { id: '0455-s24-12-q12-opt-c', text_markdown: "Yes | Yes | No" },
      { id: '0455-s24-12-q12-opt-d', text_markdown: "Yes | Yes | Yes" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q12",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q13',
    stem_markdown: "What is a variable cost for a firm?",
    options: [
      { id: '0455-s24-12-q13-opt-a', text_markdown: "the cost of raw materials" },
      { id: '0455-s24-12-q13-opt-b', text_markdown: "the interest payment on existing loans" },
      { id: '0455-s24-12-q13-opt-c', text_markdown: "the rent on the factory" },
      { id: '0455-s24-12-q13-opt-d', text_markdown: "the insurance on the factory buildings" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q13",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q14',
    stem_markdown: "The table shows the daily average revenue and units of output sold for a firm producing bicycles over a five day period.\n\n| day | average revenue (\\$) | units of output sold |\n| :---: | :---: | :---: |\n| 1 | 200 | 2 |\n| 2 | 160 | 4 |\n| 3 | 120 | 8 |\n| 4 | 80 | 14 |\n| 5 | 40 | 16 |\n\nWhat can be concluded from the table?",
    options: [
      { id: '0455-s24-12-q14-opt-a', text_markdown: "The firm's highest total revenue occurs at 2 units of output sold." },
      { id: '0455-s24-12-q14-opt-b', text_markdown: "The firm's highest total revenue occurs at 14 units of output sold." },
      { id: '0455-s24-12-q14-opt-c', text_markdown: "The firm's prices are always greater than total revenue." },
      { id: '0455-s24-12-q14-opt-d', text_markdown: "The firm's total revenue always increases as output rises." }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q14",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q15',
    stem_markdown: "Which function of money acts as a measure of value?",
    options: [
      { id: '0455-s24-12-q15-opt-a', text_markdown: "a medium of exchange" },
      { id: '0455-s24-12-q15-opt-b', text_markdown: "a standard of deferred payment" },
      { id: '0455-s24-12-q15-opt-c', text_markdown: "a store of wealth" },
      { id: '0455-s24-12-q15-opt-d', text_markdown: "a unit of account" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q15",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q16',
    stem_markdown: "What are the features of a highly competitive market when compared with a monopoly market?",
    options: [
      { id: '0455-s24-12-q16-opt-a', text_markdown: "Higher | Higher" },
      { id: '0455-s24-12-q16-opt-b', text_markdown: "Higher | Lower" },
      { id: '0455-s24-12-q16-opt-c', text_markdown: "Lower | Higher" },
      { id: '0455-s24-12-q16-opt-d', text_markdown: "Lower | Lower" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q16",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q17',
    stem_markdown: "What is **not** a role of central government in a mixed economy?",
    options: [
      { id: '0455-s24-12-q17-opt-a', text_markdown: "providing demerit goods" },
      { id: '0455-s24-12-q17-opt-b', text_markdown: "providing merit goods" },
      { id: '0455-s24-12-q17-opt-c', text_markdown: "providing public goods" },
      { id: '0455-s24-12-q17-opt-d', text_markdown: "stabilising the economy" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q17",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
  },
  {
    id: '0455-s24-12-q18',
    stem_markdown: "A government wishes to prevent deflation.\n\nWhich combination of policies would be the most effective in achieving this aim?",
    options: [
      { id: '0455-s24-12-q18-opt-a', text_markdown: "Increase | Increase" },
      { id: '0455-s24-12-q18-opt-b', text_markdown: "Increase | Reduce" },
      { id: '0455-s24-12-q18-opt-c', text_markdown: "Reduce | Increase" },
      { id: '0455-s24-12-q18-opt-d', text_markdown: "Reduce | Reduce" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q18",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
  },
  {
    id: '0455-s24-12-q19',
    stem_markdown: "The diagram shows the impact of a tax introduced on a product.\n\nWhich area represents the amount of tax paid by the consumer?",
    options: [
      { id: '0455-s24-12-q19-opt-a', text_markdown: "HP1FG" },
      { id: '0455-s24-12-q19-opt-b', text_markdown: "HP2EG" },
      { id: '0455-s24-12-q19-opt-c', text_markdown: "OP2EQ2" },
      { id: '0455-s24-12-q19-opt-d', text_markdown: "P1P2EF" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q19",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
    has_diagram: true,
    image_url: "/questions/0455_2024_s_12_q19.png",
  },
  {
    id: '0455-s24-12-q20',
    stem_markdown: "Which statement about supply-side policy is correct?",
    options: [
      { id: '0455-s24-12-q20-opt-a', text_markdown: "It aims to increase the productive potential of the economy." },
      { id: '0455-s24-12-q20-opt-b', text_markdown: "It aims to increase total demand in the economy." },
      { id: '0455-s24-12-q20-opt-c', text_markdown: "It involves changes in the equilibrium foreign exchange rate." },
      { id: '0455-s24-12-q20-opt-d', text_markdown: "It involves changes in the rate of interest." }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q20",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
  },
  {
    id: '0455-s24-12-q21',
    stem_markdown: "Which change is most likely to cause faster economic growth in the short run?",
    options: [
      { id: '0455-s24-12-q21-opt-a', text_markdown: "an increase in net emigration" },
      { id: '0455-s24-12-q21-opt-b', text_markdown: "an increase in the birth rate" },
      { id: '0455-s24-12-q21-opt-c', text_markdown: "an increase in the death rate" },
      { id: '0455-s24-12-q21-opt-d', text_markdown: "an increase in the retirement age" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q21",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
  },
  {
    id: '0455-s24-12-q22',
    stem_markdown: "How is the pattern of employment likely to change when a country becomes more developed?",
    options: [
      { id: '0455-s24-12-q22-opt-a', text_markdown: "from rural employment to urban employment" },
      { id: '0455-s24-12-q22-opt-b', text_markdown: "from skilled employment to primary employment" },
      { id: '0455-s24-12-q22-opt-c', text_markdown: "from technical employment to manual employment" },
      { id: '0455-s24-12-q22-opt-d', text_markdown: "from tertiary employment to secondary employment" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q22",
    topic_id: 'c9501184-3e43-4b00-aac5-791638119278',
    topic: "Economic development",
  },
  {
    id: '0455-s24-12-q23',
    stem_markdown: "Which item is **least** likely to be included in the Consumer Prices Index (CPI)?",
    options: [
      { id: '0455-s24-12-q23-opt-a', text_markdown: "domestic cooking oil" },
      { id: '0455-s24-12-q23-opt-b', text_markdown: "homemade clothes" },
      { id: '0455-s24-12-q23-opt-c', text_markdown: "milk" },
      { id: '0455-s24-12-q23-opt-d', text_markdown: "personal mobile phones" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q23",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
  },
  {
    id: '0455-s24-12-q24',
    stem_markdown: "The table shows statistics for four countries A, B, C and D.\n\n| Country | Average years of schooling | Life expectancy (years) | GDP per head (\\$) |\n| :--- | :---: | :---: | :---: |\n| A | 6 | 45 | 200 |\n| B | 7 | 47 | 200 |\n| C | 9 | 60 | 220 |\n| D | 12 | 59 | 1500 |\n\nAccording to the data provided, which country has the lowest standard of living?",
    options: [
      { id: '0455-s24-12-q24-opt-a', text_markdown: "A" },
      { id: '0455-s24-12-q24-opt-b', text_markdown: "B" },
      { id: '0455-s24-12-q24-opt-c', text_markdown: "C" },
      { id: '0455-s24-12-q24-opt-d', text_markdown: "D" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q24",
    topic_id: 'c9501184-3e43-4b00-aac5-791638119278',
    topic: "Economic development",
  },
  {
    id: '0455-s24-12-q25',
    stem_markdown: "Economic development in country X has progressed at a greater rate than in country Y .\n\nWhat is the most likely explanation of this difference in economic development between country X and country Y?",
    options: [
      { id: '0455-s24-12-q25-opt-a', text_markdown: "Country X has a higher level of spending on education than country Y ." },
      { id: '0455-s24-12-q25-opt-b', text_markdown: "Country X has a higher level of unemployment than country Y ." },
      { id: '0455-s24-12-q25-opt-c', text_markdown: "Country Y has a higher level of investment spending than country X." },
      { id: '0455-s24-12-q25-opt-d', text_markdown: "Country Y has a higher level of spending on healthcare than country X." }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q25",
    topic_id: 'c9501184-3e43-4b00-aac5-791638119278',
    topic: "Economic development",
  },
  {
    id: '0455-s24-12-q26',
    stem_markdown: "A rise in which factor would cause an increase in the population growth rate of a country?",
    options: [
      { id: '0455-s24-12-q26-opt-a', text_markdown: "birth rate" },
      { id: '0455-s24-12-q26-opt-b', text_markdown: "death rate" },
      { id: '0455-s24-12-q26-opt-c', text_markdown: "infant mortality rate" },
      { id: '0455-s24-12-q26-opt-d', text_markdown: "net emigration" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q26",
    topic_id: 'c9501184-3e43-4b00-aac5-791638119278',
    topic: "Economic development",
  },
  {
    id: '0455-s24-12-q27',
    stem_markdown: "The diagram shows the market for an imported good with equilibrium at point X.\n\nThe country imposes a tariff on this good.\n\nIs the new equilibrium at point A, B, C or D?",
    options: [
      { id: '0455-s24-12-q27-opt-a', text_markdown: "A" },
      { id: '0455-s24-12-q27-opt-b', text_markdown: "B" },
      { id: '0455-s24-12-q27-opt-c', text_markdown: "C" },
      { id: '0455-s24-12-q27-opt-d', text_markdown: "D" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q27",
    topic_id: '941a998b-8700-47b5-8695-c262070d4949',
    topic: "International trade and globalisation",
    has_diagram: true,
    image_url: "/questions/0455_2024_s_12_q27.png",
  },
  {
    id: '0455-s24-12-q28',
    stem_markdown: "The diagram shows the market for the Chinese yuan (¥) priced in US dollars (\\$).\n\nWhat could have caused the change in demand for the yuan from $D_1$ to $D_2$?",
    options: [
      { id: '0455-s24-12-q28-opt-a', text_markdown: "a decrease in foreign direct investment in China" },
      { id: '0455-s24-12-q28-opt-b', text_markdown: "a decrease in the level of tariffs levied by China on imports" },
      { id: '0455-s24-12-q28-opt-c', text_markdown: "an increase in the buying of yuan by central banks" },
      { id: '0455-s24-12-q28-opt-d', text_markdown: "an increase in the Chinese rate of interest" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q28",
    topic_id: '941a998b-8700-47b5-8695-c262070d4949',
    topic: "International trade and globalisation",
    has_diagram: true,
    image_url: "/questions/0455_2024_s_12_q28.png",
  },
  {
    id: '0455-s24-12-q29',
    stem_markdown: "The table shows the average exchange rate of the UK pound (£) to the US dollar (\\$), that is the amount of \\$ that can be bought with £1.\n\n| year | exchange rate<br>UK£ / US\\$ |\n| :---: | :---: |\n| 1 | 1.64 |\n| 2 | 1.52 |\n| 3 | 1.35 |\n| 4 | 1.25 |\n\nWhat is a likely effect of this change on the UK economy?",
    options: [
      { id: '0455-s24-12-q29-opt-a', text_markdown: "decreased cost-push inflation" },
      { id: '0455-s24-12-q29-opt-b', text_markdown: "decreased current account deficit" },
      { id: '0455-s24-12-q29-opt-c', text_markdown: "increased quantity of imports" },
      { id: '0455-s24-12-q29-opt-d', text_markdown: "increased trade deficit" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q29",
    topic_id: '941a998b-8700-47b5-8695-c262070d4949',
    topic: "International trade and globalisation",
  },
  {
    id: '0455-s24-12-q30',
    stem_markdown: "The table shows components of Japan’s current account balance in trillion yen (¥) for 2 years.\n\n| year | balance of goods<br>(¥ trillion) | balance of services<br>(¥ trillion) | balance of primary income<br>(¥ trillion) | balance of secondary income<br>(¥ trillion) |\n| :---: | :---: | :---: | :---: | :---: |\n| 1 | –1.61 | –1.76 | 14.04 | –1.11 |\n| 2 | –5.23 | –2.33 | 13.55 | –1.02 |\n\nWhich balance improved between year 1 and year 2?",
    options: [
      { id: '0455-s24-12-q30-opt-a', text_markdown: "balance of goods" },
      { id: '0455-s24-12-q30-opt-b', text_markdown: "balance of primary income" },
      { id: '0455-s24-12-q30-opt-c', text_markdown: "balance of secondary income" },
      { id: '0455-s24-12-q30-opt-d', text_markdown: "balance of services" }
    ],
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q30",
    topic_id: '941a998b-8700-47b5-8695-c262070d4949',
    topic: "International trade and globalisation",
  }
];

let _cachedQuestions: Question[] = [];

export function setCachedQuestions(questions: Question[]): void {
  _cachedQuestions = questions;
}

export function getCachedQuestions(): Question[] {
  return _cachedQuestions;
}

export function getAllQuestions(pool?: Question[]): Question[] {
  return pool ?? _cachedQuestions;
}

export function getQuestionsForTopic(topicId: string, pool?: Question[]): Question[] {
  const source = pool ?? _cachedQuestions;
  return source.filter((q) => q.topic_id === topicId);
}

export function getQuestionsByIds(ids: string[], pool?: Question[]): Question[] {
  const set = new Set(ids);
  const source = pool ?? _cachedQuestions;
  return source.filter((q) => set.has(q.id));
}

export function isDiagramQuestion(q: Question): boolean {
  return Boolean(
    q.has_diagram ||
    q.diagram?.has_diagram ||
    q.image_url ||
    q.diagram?.image_url
  );
}

const GRAPH_REGEX =
  /\b(graph|graphs|curve|curves|ppc|axis|axes|coordinate|coordinates|trend|trends|slope|slopes|demand and supply|demand|supply|equilibrium|disequilibrium|exchange rate|exchange rates|tariff|tariffs|wage rate|wage rates|inflation|tax|taxes|subsidy|subsidies|quota|quotas|production possibility|market for|shifts? in|movement along|price and quantity|price \(?p\)?|quantity \(?q\)?)\b/i;

export function isGraphQuestion(q: Question): boolean {
  if (!isDiagramQuestion(q)) return false;
  const diagMeta = (q as { diagram_metadata?: { description?: string; type?: string } }).diagram_metadata;
  const text = `${q.stem_markdown || ''} ${q.diagram?.alt_description || ''} ${diagMeta?.description || ''} ${diagMeta?.type || ''} ${(q.tags || []).join(' ')}`.toLowerCase();
  return GRAPH_REGEX.test(text);
}

export function filterQuestionsByDiagram(
  questions: Question[],
  filter?: DiagramFilter
): Question[] {
  if (!filter || filter === 'all' || filter === 'mixed') {
    return questions;
  }
  if (filter === 'graph') {
    return questions.filter(isGraphQuestion);
  }
  if (filter === 'diagram') {
    return questions.filter(
      (q) => !isGraphQuestion(q) && (isDiagramQuestion(q) || hasDataTable(q.stem_markdown, q))
    );
  }
  if (filter === 'diagrams') {
    return questions.filter(isDiagramQuestion);
  }
  if (filter === 'text') {
    return questions.filter(
      (q) => !isGraphQuestion(q) && !isDiagramQuestion(q) && !hasDataTable(q.stem_markdown, q)
    );
  }
  if (filter === 'no-diagrams') {
    return questions.filter((q) => !isDiagramQuestion(q));
  }
  return questions;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permanently deletes questions from Supabase by their IDs.
 * Calls /api/questions/delete with a fallback to direct Supabase client call.
 * Prunes the internal _cachedQuestions array to maintain runtime consistency.
 */
export async function deleteQuestionsFromDb(
  questionIds: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!questionIds || questionIds.length === 0) {
    return { success: true, count: 0 };
  }

  const idsSet = new Set(questionIds);

  // 1. Attempt API route deletion via fetch
  try {
    const response = await authFetch('/api/questions/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionIds }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Synchronize runtime cache
        _cachedQuestions = _cachedQuestions.filter((q) => !idsSet.has(q.id));
        return {
          success: true,
          count: typeof data.count === 'number' ? data.count : questionIds.length,
        };
      } else {
        throw new Error(data.error || 'API deletion reported failure');
      }
    } else {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `API returned status ${response.status}`);
    }
  } catch (apiError: any) {
    // 2. Fallback: Direct Supabase client deletion
    try {
      const uuidIds = questionIds.filter((id) => UUID_REGEX.test(id));
      if (uuidIds.length > 0) {
        const { error } = await supabase
          .from('questions')
          .delete()
          .in('id', uuidIds);

        if (error) {
          return {
            success: false,
            count: 0,
            error: error.message || 'Direct Supabase deletion failed',
          };
        }
      }

      // Synchronize runtime cache
      _cachedQuestions = _cachedQuestions.filter((q) => !idsSet.has(q.id));
      return {
        success: true,
        count: questionIds.length,
      };
    } catch (fallbackError: any) {
      return {
        success: false,
        count: 0,
        error: fallbackError?.message || apiError?.message || 'Deletion failed',
      };
    }
  }
}

export interface QuestionDbUpdates {
  status?: string;
  difficulty?: string;
  topicName?: string;
  topicId?: string;
}

/**
 * Updates questions in Supabase with status, difficulty, or topic assignments.
 * Calls /api/questions/update when in browser, with direct Supabase client fallback
 * updating active, topic_id, and merging bank_status / difficulty into diagram_metadata
 * so it works 100% reliably even before schema migration is applied remotely.
 * Also synchronizes the runtime _cachedQuestions.
 */
export async function updateQuestionsInDb(
  questionIds: string[],
  updates: QuestionDbUpdates
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (!questionIds || questionIds.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const idsSet = new Set(questionIds);

  // Local in-memory cache synchronizer
  const syncLocalCache = (resolvedTopicId?: string) => {
    if (_cachedQuestions && _cachedQuestions.length > 0) {
      _cachedQuestions = _cachedQuestions.map((q) => {
        if (!idsSet.has(q.id)) return q;
        const currentDiagram = q.diagram || {};
        const nextDiagram = {
          ...currentDiagram,
          ...(updates.status ? { bank_status: updates.status } : {}),
          ...(updates.difficulty ? { difficulty: updates.difficulty } : {}),
        };
        return {
          ...q,
          ...(updates.topicName ? { topic: updates.topicName } : {}),
          ...(resolvedTopicId ? { topic_id: resolvedTopicId } : updates.topicId ? { topic_id: updates.topicId } : {}),
          diagram: nextDiagram,
        };
      });
    }
  };

  // 1. Attempt API route update via fetch when in browser
  if (typeof window !== 'undefined') {
    try {
      const response = await authFetch('/api/questions/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionIds, updates }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          syncLocalCache(data.resolvedTopicId);
          return {
            success: true,
            updatedCount: typeof data.updatedCount === 'number' ? data.updatedCount : questionIds.length,
          };
        } else {
          throw new Error(data.error || 'API update reported failure');
        }
      } else {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `API returned status ${response.status}`);
      }
    } catch (apiError: any) {
      console.warn('API update failed, falling back to direct Supabase client:', apiError?.message);
    }
  }

  // 2. Direct Supabase client fallback
  try {
    const uuidIds = questionIds.filter((id) => UUID_REGEX.test(id));
    let resolvedTopicId = updates.topicId;

    if (!resolvedTopicId && updates.topicName && updates.topicName.trim()) {
      const { data: topicData } = await supabase
        .from('topics')
        .select('id')
        .ilike('name', updates.topicName.trim())
        .maybeSingle();

      if (topicData?.id) {
        resolvedTopicId = topicData.id;
      }
    }

    if (uuidIds.length > 0) {
      // Fetch existing diagram_metadata to merge without clobbering existing diagrams
      const { data: existingRows } = await supabase
        .from('questions')
        .select('id, diagram_metadata')
        .in('id', uuidIds);

      const activeVal =
        updates.status !== undefined ? updates.status === 'Live' : undefined;

      for (const row of existingRows || []) {
        const currentMeta =
          row.diagram_metadata && typeof row.diagram_metadata === 'object'
            ? { ...row.diagram_metadata }
            : {};

        if (updates.status) {
          currentMeta.bank_status = updates.status;
        }
        if (updates.difficulty) {
          currentMeta.difficulty = updates.difficulty;
        }

        const patch: Record<string, any> = {
          diagram_metadata: currentMeta,
        };

        if (activeVal !== undefined) {
          patch.active = activeVal;
        }
        if (resolvedTopicId !== undefined) {
          patch.topic_id = resolvedTopicId;
        }

        await supabase.from('questions').update(patch).eq('id', row.id);
      }
    }

    syncLocalCache(resolvedTopicId);

    return {
      success: true,
      updatedCount: questionIds.length,
    };
  } catch (fallbackError: any) {
    console.error('Direct Supabase update failed:', fallbackError);
    return {
      success: false,
      updatedCount: 0,
      error: fallbackError?.message || 'Update failed',
    };
  }
}

/**
 * Shuffles an array of questions using the Fisher-Yates algorithm.
 * Returns a new shuffled array without mutating the original.
 */
export function shuffleQuestions(questions: Question[]): Question[] {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface FetchQuestionsFilters {
  subjectId?: string;
  topicId?: string;
  questionIds?: string[];
  paperId?: string;
  active?: boolean;
  search?: string;
  status?: string;
  difficulty?: string;
}

export type QuestionQueryFilters = FetchQuestionsFilters;

export function mapDbQuestionToQuestion(row: any): Question {
  const sortedOptions = (row.question_options || [])
    .slice()
    .sort((a: any, b: any) => (a.label || '').localeCompare(b.label || ''));

  const options = sortedOptions.map((opt: any) => ({
    id: opt.id,
    text_markdown: formatTableOptionText(opt.content_markdown || ''),
    label: opt.label,
  }));

  const topicName = row.topics?.name || undefined;
  const paper = row.papers;
  let citation = row.cambridge_source_ref;
  if (!citation && paper) {
    const parts = [
      paper.series,
      paper.year,
      paper.paper_code ? `Paper ${paper.paper_code}` : null,
      row.question_number ? `Q${row.question_number}` : null,
    ].filter(Boolean);
    citation = parts.join(' ');
  }

  const diagramMeta = row.diagram_metadata;
  const rawImageUrl = row.image_url || diagramMeta?.image_url || undefined;
  const imageUrl = resolveDiagramUrl(rawImageUrl);
  const hasDiagram = Boolean(imageUrl || diagramMeta?.has_diagram);

  return {
    id: row.id,
    stem_markdown: row.stem_markdown || '',
    options,
    citation: citation || undefined,
    topic: topicName,
    topic_id: row.topic_id || undefined,
    has_diagram: hasDiagram,
    image_url: imageUrl,
    diagram: diagramMeta
      ? { ...diagramMeta, image_url: imageUrl || diagramMeta.image_url }
      : (hasDiagram ? { has_diagram: true, image_url: imageUrl } : undefined),
    paper_id: row.paper_id || undefined,
    question_number: row.question_number ?? undefined,
    year: row.papers?.year ?? undefined,
    series: row.papers?.series ?? undefined,
    paper_code: row.papers?.paper_code ? String(row.papers.paper_code) : undefined,
  };
}

/**
 * Fetches real questions with options, topics, and papers from Supabase.
 * Returns an empty array if database contains 0 questions or on error.
 */
export async function fetchQuestionsFromDb(filters?: FetchQuestionsFilters): Promise<Question[]> {
  try {
    if (filters?.questionIds && filters.questionIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('questions')
      .select(`
        id,
        subject_id,
        paper_id,
        topic_id,
        question_number,
        stem_markdown,
        image_url,
        cambridge_source_ref,
        active,
        diagram_metadata,
        topics (
          id,
          name,
          order_index
        ),
        papers (
          id,
          series,
          paper_code,
          year
        ),
        question_options (
          id,
          label,
          content_markdown
        )
      `);

    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    if (filters?.topicId) {
      query = query.eq('topic_id', filters.topicId);
    }
    if (filters?.paperId) {
      query = query.eq('paper_id', filters.paperId);
    }
    if (filters?.questionIds && filters.questionIds.length > 0) {
      query = query.in('id', filters.questionIds);
    }
    if (typeof filters?.active === 'boolean') {
      query = query.eq('active', filters.active);
    }
    if (filters?.search && filters.search.trim()) {
      query = query.ilike('stem_markdown', `%${filters.search.trim()}%`);
    }

    query = query.order('question_number', { ascending: true });

    const { data, error } = await query;
    if (error || !data) {
      if (error) {
        console.warn('Failed to fetch questions from Supabase:', error.message);
      }
      return [];
    }

    const mapped = data.map(mapDbQuestionToQuestion);

    // Update in-memory runtime cache when fetching subject/all
    if (!filters || (!filters.topicId && !filters.questionIds && !filters.paperId)) {
      _cachedQuestions = mapped;
    }

    return mapped;
  } catch (err) {
    console.warn('Failed to fetch questions from Supabase:', err);
    return [];
  }
}

/**
 * Maps series codes to human-readable Cambridge session names.
 * e.g., 's' / 'summer' -> 'May/June', 'w' / 'winter' -> 'Oct/Nov', 'm' / 'march' -> 'Feb/March'
 */
export function formatSeriesLabel(s: string): string {
  const norm = (s || '').trim().toLowerCase();
  if (
    norm === 's' ||
    norm === 'summer' ||
    norm === 'm/j' ||
    norm === 'may/june' ||
    norm === 'may' ||
    norm === 'june'
  ) {
    return 'May/June';
  }
  if (
    norm === 'w' ||
    norm === 'winter' ||
    norm === 'o/n' ||
    norm === 'oct/nov' ||
    norm === 'october/november'
  ) {
    return 'Oct/Nov';
  }
  if (
    norm === 'm' ||
    norm === 'march' ||
    norm === 'f/m' ||
    norm === 'feb/march' ||
    norm === 'february/march'
  ) {
    return 'Feb/March';
  }
  return s || '';
}

export interface IngestedPaperSummary {
  id: string;
  cleanId: string;
  subjectCode: string;
  subjectName: string;
  year: number;
  series: string;
  seriesLabel: string;
  paperCode: string;
  title: string;
  questionsCount: number;
  diagramsCount: number;
  isPublished: boolean;
}

/**
 * Fetches all staged & published Cambridge exam papers.
 * Filters out empty papers (questionsCount === 0) and sorts by year desc, series asc, paperCode asc.
 */
export async function fetchIngestedPapers(subjectCode?: string): Promise<IngestedPaperSummary[]> {
  try {
    let res: Response | null = null;
    if (typeof window !== 'undefined') {
      res = await authFetch('/api/ingest/staged-paper');
    } else {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      try {
        res = await fetch(`${base}/api/ingest/staged-paper`);
      } catch {
        res = null;
      }
    }

    if (res && res.ok) {
      const data = await res.json();
      const rawPapers = Array.isArray(data?.stagedPapers) ? data.stagedPapers : [];
      const result: IngestedPaperSummary[] = [];

      for (const item of rawPapers) {
        const questionsCount = Number(item.questionsCount) || 0;
        if (questionsCount === 0) continue;

        let cleanId = '';
        if (typeof item.filename === 'string' && item.filename) {
          cleanId = item.filename.replace(/\.json$/i, '').trim();
        } else if (typeof item.id === 'string' && !item.id.includes('-') && item.id.includes('_')) {
          cleanId = item.id;
        }

        const itemSubjCode = String(item.subject?.code || cleanId.split('_')[0] || '0455').trim();
        if (subjectCode && itemSubjCode.toLowerCase() !== subjectCode.trim().toLowerCase()) {
          continue;
        }

        const itemSubjName = String(
          item.subject?.name || (itemSubjCode === '0455' ? 'Economics' : itemSubjCode)
        );
        const rawSeries = String(item.paper?.series || cleanId.split('_')[1]?.charAt(0) || 's');
        const seriesLabel = formatSeriesLabel(rawSeries);
        const year =
          Number(item.paper?.year) ||
          (cleanId.split('_')[1] ? 2000 + Number(cleanId.split('_')[1].slice(1)) : 2024);
        const paperCode = String(item.paper?.paper_code || cleanId.split('_')[2] || '12').replace(
          /^paper\s*/i,
          ''
        );

        if (!cleanId) {
          const sLower = rawSeries.toLowerCase();
          const y2 = String(year).slice(-2);
          cleanId = `${itemSubjCode}_${sLower}${y2}_${paperCode}`;
        }

        const diagramsCount = Number(item.diagramsCount) || 0;
        const isPublished = Boolean(item.is_published);
        const title = `${seriesLabel} ${year} · Paper ${paperCode}`;

        result.push({
          id: String(item.id || cleanId),
          cleanId,
          subjectCode: itemSubjCode,
          subjectName: itemSubjName,
          year,
          series: rawSeries,
          seriesLabel,
          paperCode,
          title,
          questionsCount,
          diagramsCount,
          isPublished,
        });
      }

      result.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year; // year desc
        if (a.series.localeCompare(b.series) !== 0) return a.series.localeCompare(b.series); // series asc
        return a.paperCode.localeCompare(b.paperCode); // paperCode asc
      });

      return result;
    }
  } catch (err) {
    console.warn('[fetchIngestedPapers] Staged papers API route fetch failed, trying database fallback:', err);
  }

  // Fallback to Supabase query or empty array on error
  try {
    const { data: papersData, error: papersErr } = await supabase
      .from('papers')
      .select('id, series, paper_code, year, subjects ( id, code, name )');

    if (!papersErr && Array.isArray(papersData) && papersData.length > 0) {
      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, paper_id, image_url, diagram_metadata');

      const qMap = new Map<string, any[]>();
      if (Array.isArray(questionsData)) {
        for (const q of questionsData) {
          if (q.paper_id) {
            const list = qMap.get(q.paper_id) || [];
            list.push(q);
            qMap.set(q.paper_id, list);
          }
        }
      }

      const list: IngestedPaperSummary[] = [];
      for (const row of papersData as any[]) {
        const subj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
        const sCode = String(subj?.code || '0455');
        if (subjectCode && sCode.toLowerCase() !== subjectCode.trim().toLowerCase()) {
          continue;
        }

        const qList = qMap.get(row.id) || [];
        const questionsCount = qList.length;
        if (questionsCount === 0) continue;

        const diagramsCount = qList.filter((q) =>
          Boolean(q.image_url || q.diagram_metadata?.has_diagram || q.diagram_metadata?.image_url)
        ).length;

        const rawSeries = String(row.series || 's');
        const seriesLabel = formatSeriesLabel(rawSeries);
        const year = Number(row.year) || 2024;
        const paperCode = String(row.paper_code || '12').replace(/^paper\s*/i, '');
        const y2 = String(year).slice(-2);
        const cleanId = `${sCode}_${rawSeries.toLowerCase()}${y2}_${paperCode}`;
        const title = `${seriesLabel} ${year} · Paper ${paperCode}`;

        list.push({
          id: row.id,
          cleanId,
          subjectCode: sCode,
          subjectName: String(subj?.name || (sCode === '0455' ? 'Economics' : sCode)),
          year,
          series: rawSeries,
          seriesLabel,
          paperCode,
          title,
          questionsCount,
          diagramsCount,
          isPublished: true,
        });
      }

      list.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        if (a.series.localeCompare(b.series) !== 0) return a.series.localeCompare(b.series);
        return a.paperCode.localeCompare(b.paperCode);
      });

      return list;
    }
  } catch (fallbackErr) {
    console.warn('[fetchIngestedPapers] Database fallback query error:', fallbackErr);
  }

  return [];
}

/**
 * Fetches all questions for a specific Cambridge paper from the staging API route,
 * falling back to Supabase database query if unavailable.
 */
export async function fetchPaperQuestions(paperIdOrCleanId: string): Promise<Question[]> {
  try {
    let res: Response | null = null;
    const endpoint = `/api/ingest/staged-paper?id=${encodeURIComponent(paperIdOrCleanId)}`;
    if (typeof window !== 'undefined') {
      res = await authFetch(endpoint);
    } else {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      try {
        res = await fetch(`${base}${endpoint}`);
      } catch {
        res = null;
      }
    }

    if (res && res.ok) {
      const data = await res.json();
      const rawQuestions = data?.paper?.questions;
      if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
        const paperMeta = data.paper?.paper;
        const subjMeta = data.paper?.subject;
        const paperYear = paperMeta?.year ? Number(paperMeta.year) : undefined;
        const paperSeries = paperMeta?.series ? String(paperMeta.series) : undefined;
        const paperCode = paperMeta?.paper_code
          ? String(paperMeta.paper_code).replace(/^paper\s*/i, '')
          : undefined;
        const seriesLabel = paperSeries ? formatSeriesLabel(paperSeries) : '';
        const paperId = data.published_exam_paper_id || data.paper?.id || paperIdOrCleanId;

        const mapped: Question[] = rawQuestions.map((q: any, idx: number) => {
          const qNum = typeof q.question_number === 'number' ? q.question_number : idx + 1;
          const qId = q.id || `${paperIdOrCleanId}-q${String(qNum).padStart(2, '0')}`;

          const rawOptions = Array.isArray(q.options) ? q.options : [];
          const sortedOptions = rawOptions.slice().sort((a: any, b: any) =>
            String(a.label || '').localeCompare(String(b.label || ''))
          );

          const options = sortedOptions.map((opt: any, optIdx: number) => {
            const label = String(opt.label || String.fromCharCode(65 + optIdx)).toUpperCase();
            const optId = opt.id || `${qId}-opt-${label.toLowerCase()}`;
            const textMarkdown = opt.content_markdown ?? opt.text_markdown ?? opt.text ?? '';
            const distractorReasoning =
              opt.distractor_reasoning ||
              (q.distractor_analysis && typeof q.distractor_analysis === 'object'
                ? q.distractor_analysis[label]
                : undefined) ||
              undefined;

            return {
              id: optId,
              label,
              text_markdown: textMarkdown,
              distractor_reasoning: distractorReasoning,
            };
          });

          let citation = q.cambridge_source_ref;
          if (!citation && (seriesLabel || paperYear || paperCode)) {
            const parts = [
              subjMeta?.code ? `Cambridge ${subjMeta.code}` : null,
              seriesLabel,
              paperYear,
              paperCode ? `Paper ${paperCode}` : null,
              `Q${qNum}`,
            ].filter(Boolean);
            citation = parts.join(' ');
          }

          const diagramMeta = q.diagram;
          const rawImageUrl = diagramMeta?.image_url || q.image_url || undefined;
          const imageUrl = resolveDiagramUrl(rawImageUrl);
          const hasDiagram = Boolean(imageUrl || diagramMeta?.has_diagram || q.has_diagram);

          return {
            id: qId,
            stem_markdown: q.stem_markdown || '',
            options,
            citation: citation || undefined,
            topic: q.topic_name || undefined,
            topic_id: q.topic_id || undefined,
            has_diagram: hasDiagram,
            image_url: imageUrl,
            diagram: diagramMeta
              ? {
                  ...diagramMeta,
                  has_diagram: hasDiagram,
                  image_url: imageUrl || diagramMeta.image_url,
                }
              : hasDiagram
              ? { has_diagram: true, image_url: imageUrl }
              : undefined,
            explanation_markdown: q.explanation_markdown || undefined,
            paper_id: paperId,
            question_number: qNum,
            year: paperYear,
            series: paperSeries,
            paper_code: paperCode,
            status: q.status || 'active',
          };
        });

        mapped.sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));
        return mapped;
      }
    }
  } catch (err) {
    console.warn(`[fetchPaperQuestions] Failed fetching from API route for "${paperIdOrCleanId}":`, err);
  }

  // Fallback to fetchQuestionsFromDb or empty array on error
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(paperIdOrCleanId)) {
      const dbQuestions = await fetchQuestionsFromDb({ paperId: paperIdOrCleanId });
      if (dbQuestions.length > 0) {
        return dbQuestions.sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));
      }
    }

    const clean = paperIdOrCleanId.replace(/\.json$/i, '').trim();
    const parts = clean.split('_');
    if (parts.length >= 3) {
      const seriesChar = parts[1].charAt(0);
      const rawY = parts[1].slice(1);
      const yearNum = rawY.length === 2 ? 2000 + Number(rawY) : Number(rawY);
      const paperCodeStr = parts[2].replace(/^paper\s*/i, '');

      const { data: matchedPapers } = await supabase
        .from('papers')
        .select('id, series, paper_code, year')
        .ilike('series', `${seriesChar}%`)
        .eq('year', yearNum)
        .eq('paper_code', paperCodeStr)
        .limit(1);

      if (matchedPapers && matchedPapers.length > 0) {
        const dbQuestions = await fetchQuestionsFromDb({ paperId: matchedPapers[0].id });
        if (dbQuestions.length > 0) {
          return dbQuestions.sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));
        }
      }
    }
  } catch (fallbackErr) {
    console.warn(`[fetchPaperQuestions] Fallback database fetch failed:`, fallbackErr);
  }

  return [];
}

/**
 * Fetches syllabus topics from Supabase.
 * Returns an empty array if database contains 0 topics or on error.
 */
export async function fetchTopicsFromDb(subjectId?: string): Promise<SyllabusTopic[]> {
  try {
    let query = supabase
      .from('topics')
      .select('id, name, order_index, subject_id')
      .order('order_index', { ascending: true });

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;
    if (error || !data) {
      if (error) {
        console.warn('Failed to fetch topics from Supabase:', error.message);
      }
      return [];
    }

    return data.map((t: any) => ({
      id: t.id,
      name: t.name,
      orderIndex: t.order_index ?? 0,
      subjectId: t.subject_id ?? undefined,
    }));
  } catch (err) {
    console.warn('Failed to fetch topics from Supabase:', err);
    return [];
  }
}

export interface UseQuestionsResult {
  questions: Question[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<Question[]>;
}

/**
 * Dynamic React hook to load questions from Supabase for a given subject.
 * Returns empty array [] if database contains 0 questions.
 */
export function useQuestions(subjectId?: string): UseQuestionsResult {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { userProfile } = useAuth();
  const isStaff = userProfile?.role === 'teacher' || userProfile?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await fetchQuestionsFromDb(subjectId ? { subjectId } : undefined);
      if (isStaff) data = await attachAnswerKeys(data);
      setQuestions(data);
      return data;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setQuestions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [subjectId, isStaff]);

  useEffect(() => {
    let active = true;
    load().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { questions, loading, error, refetch: load };
}

export interface UseTopicsResult {
  topics: SyllabusTopic[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<SyllabusTopic[]>;
}

/**
 * Dynamic React hook to load topics from Supabase for a given subject.
 * Returns empty array [] if database contains 0 topics.
 */
export function useTopics(subjectId?: string): UseTopicsResult {
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopicsFromDb(subjectId);
      setTopics(data);
      return data;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setTopics([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    let active = true;
    load().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { topics, loading, error, refetch: load };
}


