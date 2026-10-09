import type { Question } from '@/hooks/useQuizGame';
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
    id: '8d3cd96b-5f8c-4614-98a8-ced406d6c77e',
    stem_markdown: 'What is the fundamental economic problem?',
    options: [
      { id: '597a8465-5202-406e-8e4d-17c8caee4dca', text_markdown: 'Scarcity of resources relative to unlimited wants' },
      { id: 'e24ddd86-a915-4d76-b2a1-82e65f3bbe8a', text_markdown: 'Inequality in the distribution of income' },
      { id: '349e0622-6bf2-42fa-bc26-bc28e7a6adc8', text_markdown: 'High levels of unemployment' },
      { id: 'a11d7827-de0a-4f28-bd9a-5e5da2de5633', text_markdown: 'Fluctuations in the business cycle' },
    ],
    correct_option_id: '597a8465-5202-406e-8e4d-17c8caee4dca',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q1',
    topic_id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
    topic: 'The basic economic problem',
  },
  {
    id: 'd547e8db-1d9c-4be5-862d-e4db3c7dbc7d',
    stem_markdown: 'Which of the following is a function of the price mechanism?',
    options: [
      { id: '833c49b3-3a58-4751-bb1f-73c5f9d69aff', text_markdown: 'To ensure equality of income' },
      { id: 'b207ee23-a0d4-49da-acbc-e7987067ead6', text_markdown: 'To signal shortages and surpluses' },
      { id: '0f184836-f5e5-480b-aed7-4e031a5e8a1d', text_markdown: 'To eliminate market failure' },
      { id: 'c23cf08e-2611-43cb-ab7a-f71cca6f33c2', text_markdown: 'To provide public goods' },
    ],
    correct_option_id: 'b207ee23-a0d4-49da-acbc-e7987067ead6',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q2',
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: 'The allocation of resources',
  },
  {
    id: '63e62e68-9f70-46bd-9b07-b98b542c22dc',
    stem_markdown: 'What is meant by the price elasticity of demand?',
    options: [
      { id: 'ab581ad9-ef75-4f95-8b59-f6a5c31de6bc', text_markdown: 'The responsiveness of demand to a change in income' },
      { id: 'ab36a803-fd9f-4c09-908c-bb565fe18cd7', text_markdown: 'The responsiveness of demand to a change in price' },
      { id: '59673e1e-8b7d-446a-ad61-f0812f5cb3e9', text_markdown: 'The change in price divided by the change in quantity demanded' },
      { id: '9f40b6a2-5577-4b78-aa4e-f6461b86ab75', text_markdown: 'The difference between actual price and the price consumers are willing to pay' },
    ],
    correct_option_id: 'ab36a803-fd9f-4c09-908c-bb565fe18cd7',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q3',
    topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
    topic: 'The allocation of resources',
  },
  {
    id: 'c11393f8-1b42-4645-b17b-6bb3eb02291f',
    stem_markdown: 'Which group is considered a microeconomic decision maker?',
    options: [
      { id: 'c3b1e708-79b3-46fe-97cc-cc0749f938d3', text_markdown: 'The central bank' },
      { id: 'd57336d9-1754-4170-928a-102be78b5e53', text_markdown: 'Individual households' },
      { id: '56289b81-1a51-4cd6-8fd7-ba4efcc24220', text_markdown: 'The national government' },
      { id: 'cf85f515-b964-48e3-bcd9-9963eb7cf16c', text_markdown: 'International monetary fund' },
    ],
    correct_option_id: 'd57336d9-1754-4170-928a-102be78b5e53',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q4',
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: 'Microeconomic decision makers',
  },
  {
    id: '3e6d162a-da61-49fc-a408-1b61b4fa388d',
    stem_markdown: 'What is the main objective of a private sector firm?',
    options: [
      { id: 'e0f2f534-9702-4e2d-84e3-c52f5dea7f47', text_markdown: 'Profit maximisation' },
      { id: 'aefbab30-c814-487b-9dad-f05c2fd67df1', text_markdown: 'Providing free goods' },
      { id: 'c50c6459-88df-46de-8c62-abdb96784959', text_markdown: 'Reducing unemployment' },
      { id: '43f044b3-e1ae-40d7-b961-f0b281394d85', text_markdown: 'Ensuring economic growth' },
    ],
    correct_option_id: 'e0f2f534-9702-4e2d-84e3-c52f5dea7f47',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q5',
    topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
    topic: 'Microeconomic decision makers',
  },
  {
    id: '44f3cfdd-0f43-4a55-a515-b96e2275fda4',
    stem_markdown: 'Which is an example of monetary policy?',
    options: [
      { id: '99076d4f-e306-4378-9e75-d15be9418e56', text_markdown: 'Changing income tax rates' },
      { id: '733e1289-0cd5-46d4-a703-f89f1ac867f5', text_markdown: 'Altering government spending' },
      { id: '329f50dd-8f7c-40d2-baf2-42b7f4bc31d1', text_markdown: 'Changing the base interest rate' },
      { id: '6112f0aa-2b1a-4d03-99a4-f9bc78d392cb', text_markdown: 'Introducing tariffs on imports' },
    ],
    correct_option_id: '329f50dd-8f7c-40d2-baf2-42b7f4bc31d1',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q6',
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: 'Government and the macroeconomy',
  },
  {
    id: 'fc7ebe28-3ff8-4595-8094-ffa9f91631f7',
    stem_markdown: 'What is a likely consequence of high inflation?',
    options: [
      { id: '9a233b83-5aa2-48a9-ab7a-050189f93266', text_markdown: 'A fall in the real purchasing power of money' },
      { id: '6cb214e1-f207-49d8-8fc3-7a7de3ea6681', text_markdown: 'An increase in the value of savings' },
      { id: 'c3388baa-a1a3-4329-950d-4cde2ac284c0', text_markdown: 'A decrease in interest rates' },
      { id: 'd890b2b5-8db3-4549-bd2a-0a8ad43b5b0a', text_markdown: 'An improvement in the balance of trade' },
    ],
    correct_option_id: '9a233b83-5aa2-48a9-ab7a-050189f93266',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q7',
    topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
    topic: 'Government and the macroeconomy',
  },
  {
    id: 'aca671fa-ec87-412f-b30d-aed946623a1f',
    stem_markdown: 'Which indicator is commonly used to measure economic growth?',
    options: [
      { id: '8b6ed817-80ac-4c8a-9004-707f306aebba', text_markdown: 'The Consumer Prices Index (CPI)' },
      { id: '1514f81f-2ad2-42e5-93f2-5453203915ee', text_markdown: 'Real Gross Domestic Product (GDP)' },
      { id: 'ced6a38d-4cb6-48ab-b46b-057310127d02', text_markdown: 'The Human Development Index (HDI)' },
      { id: '178db920-7c46-427e-a5ef-781e44bfa10b', text_markdown: 'The rate of unemployment' },
    ],
    correct_option_id: '1514f81f-2ad2-42e5-93f2-5453203915ee',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q8',
    topic_id: 'c9501184-3e43-4b00-aac5-791638119278',
    topic: 'Economic development',
  },
  {
    id: 'ee284917-dab4-4354-9a62-48fe237497b8',
    stem_markdown: 'What is a characteristic of a developing economy?',
    options: [
      { id: '0de461e5-163f-40b1-91ed-9e1049e8406c', text_markdown: 'High life expectancy' },
      { id: 'f609f2e5-03bf-4358-a08e-abd11297759a', text_markdown: 'A large proportion of the workforce in agriculture' },
      { id: 'd97d7acc-4270-48c3-843f-d115c7930d41', text_markdown: 'High levels of capital investment' },
      { id: '1bbd60b2-d402-4f8d-825f-09a03b26a892', text_markdown: 'Low birth rates' },
    ],
    correct_option_id: 'f609f2e5-03bf-4358-a08e-abd11297759a',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q9',
    topic_id: 'c9501184-3e43-4b00-aac5-791638119278',
    topic: 'Economic development',
  },
  {
    id: '5447cce3-a8e4-4409-93ff-f532ee7e6d09',
    stem_markdown: 'What is an advantage of international trade?',
    options: [
      { id: '1e092268-6a42-4a5c-9ff7-a053e4526aca', text_markdown: 'Increased protectionism' },
      { id: '6bcd917f-2126-4027-bb89-17212d29f2a1', text_markdown: 'Greater self-sufficiency' },
      { id: 'ab3cd48e-dd26-4abf-b6c7-2347454c3bb8', text_markdown: 'Access to a wider variety of goods and services' },
      { id: 'd49b6f97-5453-4189-a46c-7d6ff5cad1c3', text_markdown: 'Protection of infant industries' },
    ],
    correct_option_id: 'ab3cd48e-dd26-4abf-b6c7-2347454c3bb8',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2025 Q10',
    topic_id: '941a998b-8700-47b5-8695-c262070d4949',
    topic: 'International trade and globalisation',
  },
];

export function getAllQuestions(): Question[] {
  return CAMBRIDGE_QUESTIONS;
}

export function getQuestionsForTopic(topicId: string): Question[] {
  return CAMBRIDGE_QUESTIONS.filter(q => q.topic_id === topicId);
}

export function getQuestionsByIds(ids: string[]): Question[] {
  const set = new Set(ids);
  return CAMBRIDGE_QUESTIONS.filter(q => set.has(q.id));
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

