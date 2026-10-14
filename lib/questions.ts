import type { Question } from '../hooks/useQuizGame';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { resolveDiagramUrl } from './resolveDiagramUrl';
export { resolveDiagramUrl };
export type { Question };

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
    correct_option_id: '0455-s24-12-q01-opt-d',
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
    correct_option_id: '0455-s24-12-q02-opt-b',
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
    correct_option_id: '0455-s24-12-q03-opt-b',
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
    correct_option_id: '0455-s24-12-q04-opt-d',
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
    correct_option_id: '0455-s24-12-q05-opt-b',
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q5",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q06',
    stem_markdown: "Supermarkets sell petrol (gas) outside their stores. They reduce the price of petrol below other suppliers to attract more customers to buy goods in the store when they buy more petrol.\n\nIf this were successful, how might it be shown on demand and supply diagrams?\n\n| | demand and supply diagram for petrol | demand and supply diagram for the store’s goods |\n| :---: | :--- | :--- |\n| **A** | shift of the demand curve to the left | shift of the supply curve to the left |\n| **B** | shift of the demand curve to the right | shift of the demand curve to the left |\n| **C** | shift of the supply curve to the left | shift of the supply curve to the right |\n| **D** | shift of the supply curve to the right | shift of the demand curve to the right |",
    options: [
      { id: '0455-s24-12-q06-opt-a', text_markdown: "petrol: shift of the demand curve to the left | store’s goods: shift of the supply curve to the left" },
      { id: '0455-s24-12-q06-opt-b', text_markdown: "petrol: shift of the demand curve to the right | store’s goods: shift of the demand curve to the left" },
      { id: '0455-s24-12-q06-opt-c', text_markdown: "petrol: shift of the supply curve to the left | store’s goods: shift of the supply curve to the right" },
      { id: '0455-s24-12-q06-opt-d', text_markdown: "petrol: shift of the supply curve to the right | store’s goods: shift of the demand curve to the right" }
    ],
    correct_option_id: '0455-s24-12-q06-opt-d',
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
    correct_option_id: '0455-s24-12-q07-opt-a',
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
    correct_option_id: '0455-s24-12-q08-opt-d',
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
    correct_option_id: '0455-s24-12-q09-opt-b',
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q9",
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: "The allocation of resources",
  },
  {
    id: '0455-s24-12-q10',
    stem_markdown: "The diagrams show the wage rates of cleaners ($OW_c$) and nurses ($OW_n$).\n\nWhat is the result if a national minimum wage of $OM$ is introduced?\n\n| | wage rates of cleaners | wage rates of nurses |\n| :---: | :---: | :---: |\n| **A** | fall | rise |\n| **B** | no change | fall |\n| **C** | rise | fall |\n| **D** | rise | no change |",
    options: [
      { id: '0455-s24-12-q10-opt-a', text_markdown: "cleaners: fall | nurses: rise" },
      { id: '0455-s24-12-q10-opt-b', text_markdown: "cleaners: no change | nurses: fall" },
      { id: '0455-s24-12-q10-opt-c', text_markdown: "cleaners: rise | nurses: fall" },
      { id: '0455-s24-12-q10-opt-d', text_markdown: "cleaners: rise | nurses: no change" }
    ],
    correct_option_id: '0455-s24-12-q10-opt-d',
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
    correct_option_id: '0455-s24-12-q11-opt-a',
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q11",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q12',
    stem_markdown: "Which combination shows the advantages of a small firm over a larger firm?\n\n| | better communication | greater independence | lower average cost |\n| :---: | :---: | :---: | :---: |\n| **A** | no | no | yes |\n| **B** | no | yes | no |\n| **C** | yes | yes | no |\n| **D** | yes | yes | yes |",
    options: [
      { id: '0455-s24-12-q12-opt-a', text_markdown: "better communication: no | greater independence: no | lower average cost: yes" },
      { id: '0455-s24-12-q12-opt-b', text_markdown: "better communication: no | greater independence: yes | lower average cost: no" },
      { id: '0455-s24-12-q12-opt-c', text_markdown: "better communication: yes | greater independence: yes | lower average cost: no" },
      { id: '0455-s24-12-q12-opt-d', text_markdown: "better communication: yes | greater independence: yes | lower average cost: yes" }
    ],
    correct_option_id: '0455-s24-12-q12-opt-c',
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
    correct_option_id: '0455-s24-12-q13-opt-a',
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
    correct_option_id: '0455-s24-12-q14-opt-b',
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
    correct_option_id: '0455-s24-12-q15-opt-d',
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q15",
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: "Microeconomic decision makers",
  },
  {
    id: '0455-s24-12-q16',
    stem_markdown: "What are the features of a highly competitive market when compared with a monopoly market?",
    options: [
      { id: '0455-s24-12-q16-opt-a', text_markdown: "price: higher | profit: higher" },
      { id: '0455-s24-12-q16-opt-b', text_markdown: "price: higher | profit: lower" },
      { id: '0455-s24-12-q16-opt-c', text_markdown: "price: lower | profit: higher" },
      { id: '0455-s24-12-q16-opt-d', text_markdown: "price: lower | profit: lower" }
    ],
    correct_option_id: '0455-s24-12-q16-opt-d',
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
    correct_option_id: '0455-s24-12-q17-opt-a',
    citation: "Cambridge IGCSE Economics 0455/12 May/June 2024 Q17",
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: "Government and the macroeconomy",
  },
  {
    id: '0455-s24-12-q18',
    stem_markdown: "A government wishes to prevent deflation.\n\nWhich combination of policies would be the most effective in achieving this aim?",
    options: [
      { id: '0455-s24-12-q18-opt-a', text_markdown: "interest rate: increase | government spending: increase" },
      { id: '0455-s24-12-q18-opt-b', text_markdown: "interest rate: increase | government spending: reduce" },
      { id: '0455-s24-12-q18-opt-c', text_markdown: "interest rate: reduce | government spending: increase" },
      { id: '0455-s24-12-q18-opt-d', text_markdown: "interest rate: reduce | government spending: reduce" }
    ],
    correct_option_id: '0455-s24-12-q18-opt-c',
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
    correct_option_id: '0455-s24-12-q19-opt-d',
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
    correct_option_id: '0455-s24-12-q20-opt-a',
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
    correct_option_id: '0455-s24-12-q21-opt-d',
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
    correct_option_id: '0455-s24-12-q22-opt-a',
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
    correct_option_id: '0455-s24-12-q23-opt-b',
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
    correct_option_id: '0455-s24-12-q24-opt-a',
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
    correct_option_id: '0455-s24-12-q25-opt-a',
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
    correct_option_id: '0455-s24-12-q26-opt-a',
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
    correct_option_id: '0455-s24-12-q27-opt-b',
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
    correct_option_id: '0455-s24-12-q28-opt-a',
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
    correct_option_id: '0455-s24-12-q29-opt-b',
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
    correct_option_id: '0455-s24-12-q30-opt-c',
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
}

export function mapDbQuestionToQuestion(row: any): Question {
  const sortedOptions = (row.question_options || [])
    .slice()
    .sort((a: any, b: any) => (a.label || '').localeCompare(b.label || ''));

  const options = sortedOptions.map((opt: any) => ({
    id: opt.id,
    text_markdown: opt.content_markdown || '',
    label: opt.label,
    distractor_reasoning: opt.distractor_reasoning || undefined,
  }));

  const correctOption = sortedOptions.find((opt: any) => opt.is_correct);
  const correct_option_id = correctOption ? correctOption.id : (sortedOptions[0]?.id ?? '');

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
    correct_option_id,
    citation: citation || undefined,
    topic: topicName,
    topic_id: row.topic_id || undefined,
    has_diagram: hasDiagram,
    image_url: imageUrl,
    diagram: diagramMeta
      ? { ...diagramMeta, image_url: imageUrl || diagramMeta.image_url }
      : (hasDiagram ? { has_diagram: true, image_url: imageUrl } : undefined),
    explanation_markdown: row.explanation_markdown || undefined,
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
        explanation_markdown,
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
          content_markdown,
          is_correct,
          distractor_reasoning
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuestionsFromDb(subjectId ? { subjectId } : undefined);
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


