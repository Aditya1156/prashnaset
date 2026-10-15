-- BPSC Mains PYQ bank, 64th-71st. Generated from bpsc_mains_pyq_bank.json
-- by the same parser the app's importer uses, so the two cannot diverge.
-- Idempotent: clears the PYQ rows for this exam first, leaving learners'
-- own questions and every attempt untouched.

delete from public.mains_questions
 where source = 'PYQ'
   and exam_id = (select id from public.exams where name = 'BPSC');

insert into public.mains_questions
  (exam_id, source, exam_label, exam_year, paper, section,
   type, marks, word_limit, text_en, text_hi, directive, bihar_angle,
   topic, tags, wording_status)
values
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Analyse the political, economic and social causes of the 1857 Revolt and critically assess Bihar''s contribution to it.', null, 'analyse', true,
  'Modern History > 1857 Revolt', ARRAY['1857-revolt','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indian Councils Act, 1909.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the transition of the national movement from constitutional agitation to mass mobilisation, highlighting Bihar''s role.', null, 'discuss', true,
  'Modern History > National Movement > Phases', ARRAY['bihar','national-movement','phases']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Birsa Munda movement. (Also asked: 68th short, 66th long)', null, 'write short note', true,
  'Modern History > Tribal Movements > Birsa Munda', ARRAY['bihar','birsa-munda','tribal-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Jayaprakash Narayan and the Quit India Movement. (Also asked: 66th)', null, 'write short note', true,
  'Modern History > Quit India > JP', ARRAY['bihar','jp','quit-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the impact of Western education in Bihar, 1858–1914. (Also asked: 65th, 67th)', null, 'write short note', true,
  'Modern History > Education > Bihar', ARRAY['bihar','education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Examine the main features of Nehru''s foreign policy and how far it reflected idealism versus pragmatism.', null, 'examine', false,
  'Modern History > Nehru > Foreign Policy', ARRAY['foreign-policy','nehru']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Tagore''s contribution to Indian culture. (Also asked: 67th)', null, 'write short note', false,
  'Indian Culture > Tagore', ARRAY['tagore']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Analyse the main features of Mauryan art and architecture and assess how far they expressed political and cultural values.', null, 'analyse', false,
  'Indian Culture > Mauryan Art', ARRAY['mauryan-art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Pala art of Eastern India. (Also asked: 65th long, with Buddhism)', null, 'write short note', true,
  'Indian Culture > Pala Art', ARRAY['bihar','pala-art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indian Councils Act, 1861.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Explain to what extent British policies were responsible for the rise of the Indian National Movement.', null, 'explain', false,
  'Modern History > Rise of Nationalism', ARRAY['rise-of-nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Santhal Uprising. (Also asked: 69th short, 66th long, 63rd)', null, 'write short note', true,
  'Modern History > Tribal Movements > Santhal', ARRAY['bihar','santhal','tribal-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Describe the Champaran Indigo Movement and explain its effect on the freedom struggle. (Also asked: 69th long and short, 67th, 66th, 64th, 63rd)', null, 'describe', true,
  'Modern History > Gandhian Era > Champaran', ARRAY['bihar','champaran','gandhian-era']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Assess Mahatma Gandhi''s constructive programme.', null, 'assess', false,
  'Modern History > Gandhian Era > Constructive Programme', ARRAY['constructive-programme','gandhian-era']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Bihar''s role in the Quit India Movement.', null, 'write short note', true,
  'Modern History > Quit India > Bihar', ARRAY['bihar','quit-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Examine the spread of Western education in Bihar from the mid-nineteenth century onwards.', null, 'examine', true,
  'Modern History > Education > Bihar', ARRAY['bihar','education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the art and architecture of the Mauryan age. (Also asked: 69th, 67th, 64th long)', null, 'write short note', false,
  'Indian Culture > Mauryan Art', ARRAY['mauryan-art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 7, null,
  'Write a short note on the Patna Kalam school of painting. (Also asked: 68th short, 66th long)', null, 'write short note', true,
  'Indian Culture > Painting > Patna Kalam', ARRAY['bihar','painting','patna-kalam']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indian Councils Act, 1892.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Critically examine the contribution of the Moderate phase of the Indian National Congress.', null, 'critically examine', false,
  'Modern History > INC > Moderates', ARRAY['inc','moderates']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Trace the development of modern education in Bihar and its impact.', null, 'trace', true,
  'Modern History > Education > Bihar', ARRAY['bihar','education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on ancient cave paintings of Eastern India.', null, 'write short note', false,
  'Indian Culture > Cave Paintings', ARRAY['cave-paintings']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Explain in detail Bihar''s position as a centre of learning and spirituality since ancient times.', null, 'explain', true,
  'Indian Culture > Bihar > Centres of Learning', ARRAY['bihar','centres-of-learning']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Government of India Act, 1858.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the factors behind the emergence of the national movement and how it gave direction to the freedom struggle.', null, 'discuss', false,
  'Modern History > Rise of Nationalism', ARRAY['rise-of-nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indigo Revolt.', null, 'write short note', false,
  'Modern History > Peasant Movements > Indigo', ARRAY['indigo','peasant-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the growth of colonial technical education in Bihar under British schemes and critically analyse its impact.', null, 'discuss', true,
  'Modern History > Education > Technical > Bihar', ARRAY['bihar','education','technical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Describe Rabindranath Tagore''s ideas on society and culture.', null, 'describe', false,
  'Indian Culture > Tagore', ARRAY['tagore']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the development of caves in ancient Eastern India.', null, 'write short note', false,
  'Indian Culture > Caves', ARRAY['caves']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Analyse the development of temples in ancient North India.', null, 'analyse', false,
  'Indian Culture > Temple Architecture', ARRAY['temple-architecture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the factors that led to the formation of the INC and the British attitude towards early nationalists.', null, 'discuss', false,
  'Modern History > INC > Formation', ARRAY['formation','inc']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 1,
  'LONG', 38, null,
  'Critically analyse how Gandhi emerged as a national leader.', null, 'critically analyse', false,
  'Modern History > Gandhian Era > Rise of Gandhi', ARRAY['gandhian-era','rise-of-gandhi']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the Quit India Movement of 1942, including whether it was spontaneous.', null, 'discuss', false,
  'Modern History > Quit India', ARRAY['quit-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Gandhi''s concept of Satyagraha.', null, 'write short note', false,
  'Modern History > Gandhian Era > Satyagraha', ARRAY['gandhian-era','satyagraha']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Subhas Chandra Bose and the INA.', null, 'write short note', false,
  'Modern History > Bose & INA', ARRAY['bose-ina']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS1', 1,
  'LONG', 38, null,
  'Discuss Nehru''s views on communalism and secularism. (Also asked: 64th short)', null, 'discuss', false,
  'Modern History > Nehru > Secularism', ARRAY['nehru','secularism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'LONG', 38, null,
  'Explain the causes of the Revolt of 1857 and its effect on Bihar.', null, 'explain', true,
  'Modern History > 1857 Revolt', ARRAY['1857-revolt','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a note on Swami Sahajanand Saraswati and the Kisan Sabha movement.', null, 'write short note', true,
  'Modern History > Peasant Movements > Kisan Sabha', ARRAY['bihar','kisan-sabha','peasant-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Gandhi''s views on caste and religion.', null, 'write short note', false,
  'Modern History > Gandhian Era > Social Ideas', ARRAY['gandhian-era','social-ideas']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Dalit movement in Bihar.', null, 'write short note', true,
  'Modern History > Social Movements > Bihar', ARRAY['bihar','social-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'LONG', 38, null,
  'Explain the social and economic ideas of Ram Manohar Lohia and Jayaprakash Narayan.', null, 'explain', false,
  'Modern History > Thinkers > Lohia & JP', ARRAY['lohia-jp','thinkers']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'LONG', 38, null,
  'Critically examine the evolution of Indian nationalism from the late nineteenth century.', null, 'critically examine', false,
  'Modern History > Rise of Nationalism', ARRAY['rise-of-nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'LONG', 38, null,
  'Examine the common features of nineteenth-century tribal movements and analyse why they failed.', null, 'examine', false,
  'Modern History > Tribal Movements', ARRAY['tribal-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'LONG', 38, null,
  'Discuss nineteenth-century overseas migration with special reference to indentured labour from Bihar.', null, 'discuss', true,
  'Modern History > Indentured Labour > Bihar', ARRAY['bihar','indentured-labour']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the impact of the 1881 Census on caste and religious identity.', null, 'write short note', false,
  'Modern History > Society > Census', ARRAY['census','society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the working class and the national movement.', null, 'write short note', false,
  'Modern History > Working Class', ARRAY['working-class']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Anti-immigration trends in Western democracies. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Global Politics > Migration', ARRAY['global-politics','migration']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'India–Afghanistan relations. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > IR > India–Afghanistan', ARRAY['india-afghanistan','ir']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Aspirational Districts Programme and decentralisation. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Governance > Aspirational Districts', ARRAY['aspirational-districts','governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Online Gaming Regulation Bill, 2025. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Governance > Online Gaming', ARRAY['governance','online-gaming']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'WHO concerns over drug-safety regulation in India. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Health > Drug Regulation', ARRAY['drug-regulation','health']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Three years into the Russia–Ukraine war, explain its causes and its effects on world politics. (Also asked: 67th, with impact on India)', null, 'discuss', false,
  'Current Affairs > IR > Russia–Ukraine', ARRAY['ir','russia-ukraine']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Analyse the likely national and international course of the US under the newly elected President Trump.', null, 'analyse', false,
  'Current Affairs > IR > USA', ARRAY['ir','usa']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Discuss the direction of opposition unity and coalition politics, and why AAP lost the 2025 Delhi Assembly election.', null, 'discuss', false,
  'Current Affairs > Elections', ARRAY['elections']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain in detail the need for and importance of the caste-based census in Bihar.', null, 'explain', true,
  'Current Affairs > Society > Caste Census', ARRAY['bihar','caste-census','society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'With reference to Uttarakhand adopting a UCC first, explain its social, cultural, religious and legal implications with examples. (Also asked: 69th)', null, 'explain', false,
  'Current Affairs > Polity > UCC', ARRAY['polity','ucc']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'Discuss the constitutional provisions on President''s Rule, why it was imposed in Manipur, and evaluate its effectiveness today.', null, 'discuss', false,
  'Current Affairs > Polity > President''s Rule', ARRAY['polity','president-s-rule']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'Discuss One Nation One Election and its effect on federalism; analyse the pros and cons of simultaneous polls. (Also asked: 67th)', null, 'discuss', false,
  'Current Affairs > Polity > One Nation One Election', ARRAY['one-nation-one-election','polity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'Analyse women''s political participation and the changes expected from the Women''s Reservation Act, 2023.', null, 'analyse', false,
  'Current Affairs > Polity > Women''s Reservation', ARRAY['polity','women-s-reservation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain with examples how Maha Kumbh 2025 symbolised Indian culture, faith and social harmony.', null, 'explain', false,
  'Current Affairs > Culture > Maha Kumbh', ARRAY['culture','maha-kumbh']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Examine how India''s G-20 presidency reflects the idea of Vasudhaiva Kutumbakam.', null, 'examine', false,
  'Current Affairs > Intl Orgs > G-20', ARRAY['g-20','intl-orgs']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain the Supreme Court''s concern about combating gender stereotypes.', null, 'explain', false,
  'Current Affairs > Judiciary > Gender', ARRAY['gender','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Examine the relevance of the Bharatiya Nagarik Suraksha Sanhita, 2023 to governance.', null, 'examine', false,
  'Current Affairs > Criminal Law Reform', ARRAY['criminal-law-reform']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Evaluate the role of AI in decision-making by legislative institutions.', null, 'evaluate', false,
  'Current Affairs > Governance > AI', ARRAY['ai','governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Give an overview of the Manipur crisis and comment on its possible repercussions for national politics.', null, 'comment', false,
  'Current Affairs > Internal Security > Manipur', ARRAY['internal-security','manipur']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Describe the parameters and findings of the ILO Global Wage Report 2022–23.', null, 'describe', false,
  'Current Affairs > Economy > Reports', ARRAY['economy','reports']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'State the main provisions of Foreign Trade Policy 2023 for export promotion.', null, 'state', false,
  'Current Affairs > Economy > Trade Policy', ARRAY['economy','trade-policy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Discuss how India''s rise as a space power matches its ambitions, citing Chandrayaan-3.', null, 'discuss', false,
  'Current Affairs > S&T > Chandrayaan-3', ARRAY['chandrayaan-3','s-t']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Should India reclaim leadership of the developing world through its G-20 presidency? Can it unite the Global South despite its own challenges? Give arguments.', null, 'argue', false,
  'Current Affairs > Intl Orgs > G-20 & Global South', ARRAY['g-20-global-south','intl-orgs']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Evaluate the UN''s role in access and resource management after the Syria–Turkey earthquake.', null, 'evaluate', false,
  'Current Affairs > Intl Orgs > UN', ARRAY['intl-orgs','un']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain the mandate of the UN Public Administration Network under SDG-16.', null, 'explain', false,
  'Current Affairs > Intl Orgs > UN & SDG-16', ARRAY['intl-orgs','un-sdg-16']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Explain the UGC draft rules on foreign university campuses, their prospects, and whether they will be a game-changer.', null, 'explain', false,
  'Current Affairs > Education > UGC Foreign Campuses', ARRAY['education','ugc-foreign-campuses']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Critically examine the basic-structure doctrine in light of recent criticism by the Vice-President, and whether it risks an executive–judiciary clash.', null, 'critically examine', false,
  'Current Affairs > Polity > Basic Structure', ARRAY['basic-structure','polity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Discuss rights-based e-service delivery in Bihar.', null, 'discuss', true,
  'Current Affairs > Bihar > e-Governance', ARRAY['bihar','e-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Describe Bihar''s efforts in solar power generation.', null, 'describe', true,
  'Current Affairs > Bihar > Solar Energy', ARRAY['bihar','solar-energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Critically examine the features of Bihar''s Saat Nischay-2 (2020–25) programme.', null, 'critically examine', true,
  'Current Affairs > Bihar > Saat Nischay-2', ARRAY['bihar','saat-nischay-2']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'State where the 18th National Scouts & Guides Jamboree was held and describe its objectives.', null, 'describe', false,
  'Current Affairs > National Events', ARRAY['national-events']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 2,
  'LONG', 38, null,
  'Discuss the significance of QUAD for India.', null, 'discuss', false,
  'Current Affairs > IR > QUAD', ARRAY['ir','quad']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 2,
  'LONG', 38, null,
  'Comment on whether the Agnipath scheme means development or destruction.', null, 'comment', false,
  'Current Affairs > Defence > Agnipath', ARRAY['agnipath','defence']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 2,
  'LONG', 38, null,
  'Do you agree that ruling parties misuse constitutional institutions? Discuss.', null, 'discuss', false,
  'Current Affairs > Polity > Constitutional Institutions', ARRAY['constitutional-institutions','polity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Hospital admissions table by department and gender: find highest female share, inter-department ratios, departments above one-quarter of admissions, and revised ratios after value changes.', null, 'calculate', false,
  'Statistics > Data Interpretation > Table', ARRAY['data-interpretation','table']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Graph of over-60 population by state, rural/urban and sex: find highest proportions, urban-to-rural and male-to-female ratios.', null, 'calculate', false,
  'Statistics > Data Interpretation > Graph', ARRAY['data-interpretation','graph']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'NEET/JEE qualifiers across seven states: compute totals and inter-state ratios.', null, 'calculate', false,
  'Statistics > Data Interpretation > Bar/Pie', ARRAY['bar-pie','data-interpretation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Married and divorced population of seven towns (graph + table): find unknowns, project 10%/5% changes, approximate ratio.', null, 'calculate', false,
  'Statistics > Data Interpretation > Mixed', ARRAY['data-interpretation','mixed']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Candidates appeared, qualified and selected in five states over several years: best average, highest qualified/appeared and selected/appeared percentages, ratios.', null, 'calculate', false,
  'Statistics > Data Interpretation > Table', ARRAY['data-interpretation','table']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Bar diagram of paddy, wheat and maize output: ratio of totals, share percentage, average as percentage, change needed, percentage-change scenario.', null, 'calculate', false,
  'Statistics > Data Interpretation > Bar', ARRAY['bar','data-interpretation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Pie charts of spending by two families: combined totals, one head as percentage of another, effect of percentage rises, cut needed to offset.', null, 'calculate', false,
  'Statistics > Data Interpretation > Pie', ARRAY['data-interpretation','pie']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Line graph of exports of three firms: steepest annual rise, highest percentage growth, ratios after growth, back-calculation to an earlier year.', null, 'calculate', false,
  'Statistics > Data Interpretation > Line', ARRAY['data-interpretation','line']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Table of soap units and prices for three firms: average price, percentage fall, market share, peak year, gap between maximum and minimum.', null, 'calculate', false,
  'Statistics > Data Interpretation > Table', ARRAY['data-interpretation','table']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Pie chart of calculator manufacturing costs: central angle, cost price and marked price from shares, profit percentage.', null, 'calculate', false,
  'Statistics > Data Interpretation > Pie', ARRAY['data-interpretation','pie']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Two pie charts of family spending at different incomes: differences, ratios, sector angle, combined totals.', null, 'calculate', false,
  'Statistics > Data Interpretation > Pie', ARRAY['data-interpretation','pie']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Bar graph of a state''s additional tax over several years: percentage rise and fall, peak growth year, average, smallest decline.', null, 'calculate', false,
  'Statistics > Data Interpretation > Bar', ARRAY['bar','data-interpretation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Describe the main features and significance of the 42nd Amendment Act, 1976.', null, 'describe', false,
  'Polity > Amendment > 42nd Amendment', ARRAY['42nd-amendment','amendment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Can Parliament, using Article 368, destroy the basic structure of the Constitution? Discuss.', null, 'discuss', false,
  'Polity > Basic Structure > Article 368', ARRAY['article-368','basic-structure']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Critically analyse the concept of constitutional morality as developed by the Supreme Court.', null, 'critically analyse', false,
  'Polity > Constitutional Morality', ARRAY['constitutional-morality']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Explore where cultural and constitutional nationalism meet, and the basic features of cultural understanding under the Constitution.', null, 'explore', false,
  'Polity > Nationalism', ARRAY['nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'State the main role of the Finance Commission and the Article under which it is constituted.', null, 'state', false,
  'Polity > Finance Commission', ARRAY['finance-commission']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Analyse how the multi-party system affects federal stability. Have coalitions strengthened or weakened cooperative and competitive federalism?', null, 'analyse', false,
  'Polity > Federalism > Coalitions', ARRAY['coalitions','federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Give your views on the debate over supremacy between Parliament and the Judiciary.', null, 'give views', false,
  'Polity > Judiciary > Parliament vs Judiciary', ARRAY['judiciary','parliament-vs-judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain writ jurisdiction and name any three of the five writs.', null, 'explain', false,
  'Polity > Judiciary > Writs', ARRAY['judiciary','writs']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Define judicial review and state its basic purpose.', null, 'define', false,
  'Polity > Judiciary > Judicial Review', ARRAY['judicial-review','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain why Article 32 is called the heart and soul of the Constitution.', null, 'explain', false,
  'Polity > Fundamental Rights > Article 32', ARRAY['article-32','fundamental-rights']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Explain the political and constitutional changes in Jammu and Kashmir after the abrogation of Article 370.', null, 'explain', false,
  'Polity > J&K > Article 370', ARRAY['article-370','j-k']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Examine the Governor as a link between Centre and State. Can the Governor act on personal discretion?', null, 'examine', false,
  'Polity > Governor', ARRAY['governor']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'What is the collegium system? Why is it criticised? Give your views.', null, 'explain', false,
  'Polity > Judiciary > Collegium', ARRAY['collegium','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Discuss how the 73rd and 74th Amendments have empowered women at the grassroots in Bihar.', null, 'discuss', true,
  'Polity > Local Government > Women', ARRAY['bihar','local-government','women']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Trace the evolution from one-party dominance to coalitions. Has coalition politics weakened the Prime Minister''s authority?', null, 'trace', false,
  'Polity > Party System > Coalitions', ARRAY['coalitions','party-system']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Is caste now more a political than a social phenomenon in India? Give reasons.', null, 'analyse', false,
  'Polity > Caste & Politics', ARRAY['caste-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Analyse the criminalisation of politics and politicisation of criminals in the Bihar context.', null, 'analyse', true,
  'Polity > Criminalisation of Politics', ARRAY['bihar','criminalisation-of-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Language is both a medium of communication and a symbol of identity. Analyse the political impact of linguistic identity.', null, 'analyse', false,
  'Polity > Linguistic Identity', ARRAY['linguistic-identity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Critically examine the basic structure doctrine of the Constitution.', null, 'critically examine', false,
  'Polity > Basic Structure', ARRAY['basic-structure']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain how the Preamble serves as a blueprint of constitutional goals.', null, 'explain', false,
  'Polity > Preamble', ARRAY['preamble']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Critically describe the amendment process of the Constitution.', null, 'critically describe', false,
  'Polity > Amendment', ARRAY['amendment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Is reservation for Economically Weaker Sections justified? Comment.', null, 'comment', false,
  'Polity > Reservation > EWS', ARRAY['ews','reservation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine Indian federalism as a balance between cultural diversity and a larger national community.', null, 'critically examine', false,
  'Polity > Federalism > Diversity', ARRAY['diversity','federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Discuss the institutional relationship between the President and the Prime Minister and how their roles are changing.', null, 'discuss', false,
  'Polity > President & PM', ARRAY['president-pm']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Evaluate the role of local government in empowering Panchayats and urban bodies, with grassroots examples from Bihar.', null, 'evaluate', true,
  'Polity > Local Government > Bihar', ARRAY['bihar','local-government']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Discuss the basic principles of coalition politics in Bihar with respect to national interest.', null, 'discuss', true,
  'Polity > Coalition Politics > Bihar', ARRAY['bihar','coalition-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Describe how the caste census will influence Bihar''s politics.', null, 'describe', true,
  'Polity > Caste Census > Bihar', ARRAY['bihar','caste-census']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 7, null,
  'Explain with examples how the Directive Principles act as a charter of social and economic democracy.', null, 'explain', false,
  'Polity > DPSP', ARRAY['dpsp']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Critically analyse the dynamic nature of secularism in India.', null, 'critically analyse', false,
  'Polity > Secularism', ARRAY['secularism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine the nature and working of Zonal Councils in light of the paramountcy of national interest.', null, 'critically examine', false,
  'Polity > Federalism > Zonal Councils', ARRAY['federalism','zonal-councils']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Discuss the composition and powers of the Rajya Sabha and its role as the second chamber.', null, 'discuss', false,
  'Polity > Parliament > Rajya Sabha', ARRAY['parliament','rajya-sabha']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 7, null,
  'Explain the judicial review jurisdiction of the Supreme Court.', null, 'explain', false,
  'Polity > Judiciary > Judicial Review', ARRAY['judicial-review','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine the Election Commission''s role in free and fair elections, with reference to Bihar before and after T.N. Seshan.', null, 'critically examine', true,
  'Polity > Election Commission', ARRAY['bihar','election-commission']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain the role of regional politics in India.', null, 'explain', false,
  'Polity > Regionalism', ARRAY['regionalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Bihar''s political culture has improved in recent decades. Illustrate with examples.', null, 'illustrate', true,
  'Polity > Political Culture > Bihar', ARRAY['bihar','political-culture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'How has the role of caste in politics changed over the decades? Does development dilute caste?', null, 'discuss', false,
  'Polity > Caste & Politics', ARRAY['caste-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Discuss Centre–State relations with reference to Bihar and how cooperative federalism can address the problems.', null, 'discuss', true,
  'Polity > Federalism > Centre–State Relations', ARRAY['bihar','centre-state-relations','federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Is Parliament sovereign? Comment on its vast but not unlimited powers, comparing it with the British Parliament.', null, 'comment', false,
  'Polity > Parliament > Sovereignty', ARRAY['parliament','sovereignty']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Has judicial activism added to the powers of the Supreme Court? Illustrate with examples.', null, 'discuss', false,
  'Polity > Judiciary > Judicial Activism', ARRAY['judicial-activism','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Explain why regional parties emerged. Do they serve regional aspirations and national unity?', null, 'explain', false,
  'Polity > Party System > Regional Parties', ARRAY['party-system','regional-parties']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Explain why India''s federal structure is tilted towards the Centre.', null, 'explain', false,
  'Polity > Federalism', ARRAY['federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Uneven development among states creates socio-economic and political problems. Critically analyse with special reference to Bihar.', null, 'critically analyse', true,
  'Polity > Federalism > Regional Disparity', ARRAY['bihar','federalism','regional-disparity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Evaluate the comparison of the President to a family elder whose advice may be ignored.', null, 'evaluate', false,
  'Polity > President', ARRAY['president']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Discuss whether Parliament is an effective forum for national integration.', null, 'discuss', false,
  'Polity > Parliament > National Integration', ARRAY['national-integration','parliament']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'Does the Constitution give Fundamental Rights with one hand and take them back with the other? Discuss.', null, 'discuss', false,
  'Polity > Fundamental Rights', ARRAY['fundamental-rights']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'The Indian Parliament is a non-sovereign law-making body. Evaluate.', null, 'evaluate', false,
  'Polity > Parliament > Sovereignty', ARRAY['parliament','sovereignty']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'Indian political parties are individualistic rather than nationalistic. Explain with reference to Bihar.', null, 'explain', true,
  'Polity > Party System', ARRAY['bihar','party-system']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'What is e-governance? Discuss its implementation in Bihar.', null, 'discuss', true,
  'Polity > e-Governance > Bihar', ARRAY['bihar','e-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Identify the constitutional provisions that give effect to the Preamble''s ideals of a socialist, secular, democratic republic.', null, 'identify', false,
  'Polity > Preamble', ARRAY['preamble']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine the Governor''s role in state politics, especially in Bihar. Is the Governor merely a puppet?', null, 'critically examine', true,
  'Polity > Governor', ARRAY['bihar','governor']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Comment on judicial activism in Indian governance, with arguments for and against.', null, 'comment', false,
  'Polity > Judiciary > Judicial Activism', ARRAY['judicial-activism','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Too many political parties are the bane of Indian politics. Explain in the context of Bihar.', null, 'explain', true,
  'Polity > Party System', ARRAY['bihar','party-system']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Describe how natural resource management, inclusive development and e-technology help achieve Atmanirbhar and Viksit Bharat.', null, 'describe', false,
  'Economy > Development Strategy', ARRAY['development-strategy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss the main challenges facing India''s food processing industry and government initiatives for it.', null, 'discuss', false,
  'Economy > Food Processing', ARRAY['food-processing']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Explain the components of food security and justify with examples how far hydroponics can meet future demand.', null, 'explain', false,
  'Economy > Food Security > Hydroponics', ARRAY['food-security','hydroponics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Describe the concept of Industry 4.0 and critically analyse its benefits and risks for India.', null, 'critically analyse', false,
  'Economy > Industry 4.0', ARRAY['industry-4-0']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Describe government initiatives in the last ten years for inclusive and sustainable development in South Bihar.', null, 'describe', true,
  'Economy > Regional Development > South Bihar', ARRAY['bihar','regional-development','south-bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the railways'' role in national development and critically analyse barriers to rail logistics in the North-East.', null, 'critically analyse', false,
  'Geography > Transport > Railways', ARRAY['railways','transport']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the major east-coast ports and critically examine the role of Kolkata''s Syama Prasad Mookerjee Port for the North-East and Bangladesh.', null, 'critically examine', false,
  'Geography > Transport > Ports', ARRAY['ports','transport']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the conditions that favour jute cultivation in West Bengal and Bihar.', null, 'explain', true,
  'Geography > Crops > Jute', ARRAY['bihar','crops','jute']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Give an account of the environmental and social benefits of geothermal energy in India, with examples.', null, 'describe', false,
  'Geography > Energy > Geothermal', ARRAY['energy','geothermal']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Discuss the growth of the automobile industry in and around India''s four largest metro regions.', null, 'discuss', false,
  'Geography > Industrial Location > Automobiles', ARRAY['automobiles','industrial-location']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the climatic conditions and mechanism behind winter rainfall in India and where it falls.', null, 'explain', false,
  'Geography > Climate > Winter Rainfall', ARRAY['climate','winter-rainfall']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the claim that Peninsular India is richer in rocks and minerals, linking geology with quarrying and mining.', null, 'discuss', false,
  'Geography > Geology & Minerals', ARRAY['geology-minerals']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Distinguish between alluvial and diluvial soils in formation, characteristics and distribution, with examples.', null, 'distinguish', false,
  'Geography > Soils', ARRAY['soils']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the geographical conditions suitable for India''s major millets, with examples.', null, 'explain', false,
  'Geography > Crops > Millets', ARRAY['crops','millets']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Explain the ecological conditions needed for makhana and government steps to boost its production and marketing.', null, 'explain', true,
  'Geography > Crops > Makhana', ARRAY['bihar','crops','makhana']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss the environmental and economic benefits of India''s coastal mangroves, with examples.', null, 'discuss', false,
  'Geography > Ecosystems > Mangroves', ARRAY['ecosystems','mangroves']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Examine the ecological and economic benefits of solar energy in India, with examples.', null, 'examine', false,
  'Geography > Energy > Solar', ARRAY['energy','solar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the causes and effects of out-migration from Bihar and the state''s steps to address it.', null, 'discuss', true,
  'Geography > Migration > Bihar', ARRAY['bihar','migration']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Explain the trickle-down theory for Indian planning: its elements, benefits, limits and criticism.', null, 'explain', false,
  'Economy > Planning > Trickle-down', ARRAY['planning','trickle-down']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss the present state and future prospects of Indian tourism.', null, 'discuss', false,
  'Economy > Services > Tourism', ARRAY['services','tourism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Analyse the mechanism and characteristics of the Indian monsoon.', null, 'analyse', false,
  'Geography > Climate > Monsoon', ARRAY['climate','monsoon']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Explain the factors shaping Bihar''s climate, its agro-climatic zones, its seasons, and their effect on farming.', null, 'explain', true,
  'Geography > Climate > Bihar Agro-climatic Zones', ARRAY['bihar','bihar-agro-climatic-zones','climate']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Divide India into its major physiographic divisions and describe the one in which Bihar lies.', null, 'describe', true,
  'Geography > Physiography > Bihar', ARRAY['bihar','physiography']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Critically review India''s energy sources, whether they meet domestic needs, and the alternatives.', null, 'critically review', false,
  'Geography > Energy', ARRAY['energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Describe the distribution of Bihar''s SC/ST population and comment on its socio-economic status.', null, 'describe', true,
  'Geography > Population > Bihar SC/ST', ARRAY['bihar','bihar-sc-st','population']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Explain the classification of cities, Census 2011 population trends by class, and Bihar''s population and working-population trend.', null, 'explain', true,
  'Geography > Population > Urban Classification', ARRAY['bihar','population','urban-classification']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Classify Bihar''s industries as forest-, agro- and mineral-based, and show their locations on sketch maps.', null, 'classify', true,
  'Geography > Industrial Location > Bihar', ARRAY['bihar','industrial-location']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain how the National Logistics Policy 2022 and PM Gati Shakti can transform India''s logistics efficiency.', null, 'explain', false,
  'Economy > Infrastructure > Logistics', ARRAY['infrastructure','logistics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain how the Atal Innovation Mission builds innovation and entrepreneurship.', null, 'explain', false,
  'Economy > Innovation > Atal Innovation Mission', ARRAY['atal-innovation-mission','innovation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Discuss India''s rural–urban digital divide, its effects, and government steps to narrow it.', null, 'discuss', false,
  'Economy > Digital Divide', ARRAY['digital-divide']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Examine India''s global trade engagement in 2022 and its trade initiatives, and suggest ways to raise future trade.', null, 'examine', false,
  'Economy > External Sector > Trade', ARRAY['external-sector','trade']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Bihar''s tele-density is far below the national average; discuss the reasons, the impact, and the remedies.', null, 'discuss', true,
  'Economy > Telecom > Bihar', ARRAY['bihar','telecom']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Discuss why the blue economy matters for India, the steps taken, and whether they are adequate.', null, 'discuss', false,
  'Economy > Blue Economy', ARRAY['blue-economy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the Indian Ocean Dipole, its link with the erratic 2022 monsoon, and its effects on food output and the economy.', null, 'explain', false,
  'Geography > Climate > Indian Ocean Dipole', ARRAY['climate','indian-ocean-dipole']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss Bihar''s low level of urbanisation, give reasons, and describe recent state initiatives.', null, 'discuss', true,
  'Geography > Urbanisation > Bihar', ARRAY['bihar','urbanisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Compare Bihar''s industrial development with India''s, identify causes of Bihar''s backwardness, and describe recent remedial steps.', null, 'describe', true,
  'Economy > Industry > Bihar', ARRAY['bihar','industry']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Introduce JEEViKA and its objectives, and evaluate its role in empowering women in Bihar.', null, 'evaluate', true,
  'Economy > Rural Livelihoods > JEEViKA', ARRAY['bihar','jeevika','rural-livelihoods']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Given Bihar''s low rank on NITI''s Health Index, state the causes and steps taken, and assess with data whether the steps are enough.', null, 'assess', true,
  'Economy > Health > Bihar', ARRAY['bihar','health']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Name Bihar''s major natural resources, map the distribution of any two, and explain their economic importance.', null, 'explain', true,
  'Geography > Resources > Bihar', ARRAY['bihar','resources']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'The Bihar Economic Survey shows Bihar growing faster than India; discuss which sectors drove this growth.', null, 'discuss', true,
  'Economy > Bihar > Sectoral Growth', ARRAY['bihar','sectoral-growth']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'Give the causes of socio-economic disparity in Bihar and critically evaluate government measures to reduce it.', null, 'critically evaluate', true,
  'Economy > Bihar > Regional Disparity', ARRAY['bihar','regional-disparity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'Define demographic dividend, state how long India and Bihar can reap it, and describe Bihar''s steps.', null, 'explain', true,
  'Economy > Demography > Bihar', ARRAY['bihar','demography']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'Explain how human development is measured, list Bihar''s Saat Nischay commitments, and explain the schemes behind them.', null, 'explain', true,
  'Economy > Human Development > Bihar', ARRAY['bihar','human-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Discuss whether economic planning is still relevant after the reforms, and how the state and market can work together.', null, 'discuss', false,
  'Economy > Planning', ARRAY['planning']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Evaluate farm production and productivity trends since 1991, and suggest practical measures to raise them in Bihar.', null, 'evaluate', true,
  'Economy > Agriculture > Bihar', ARRAY['agriculture','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Give the new definition of MSMEs and critically evaluate their role in industrial growth and Atmanirbhar Bharat.', null, 'critically evaluate', false,
  'Economy > Industry > MSME', ARRAY['industry','msme']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Identify the main obstacles to Bihar''s rapid economic development and explain how to remove them.', null, 'explain', true,
  'Economy > Bihar > Growth Constraints', ARRAY['bihar','growth-constraints']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 2,
  'LONG', 38, null,
  'Evaluate the main achievements of economic planning in India.', null, 'evaluate', false,
  'Economy > Planning', ARRAY['planning']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 2,
  'LONG', 38, null,
  'Examine the claim that economic development cannot be judged properly unless population growth is checked.', null, 'examine', false,
  'Economy > Population & Development', ARRAY['population-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 2,
  'LONG', 38, null,
  'Critically examine the need for food security in India.', null, 'critically examine', false,
  'Economy > Food Security', ARRAY['food-security']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain how nanotechnology-based environmental monitoring can address pollution in industrial belts.', null, 'explain', false,
  'S&T > Nanotech > Environment', ARRAY['environment','nanotech']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain how remote-sensing satellites have changed disaster risk reduction, with reference to project NETRA.', null, 'explain', false,
  'S&T > Space > Remote Sensing', ARRAY['remote-sensing','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain the role of Jai Anusandhan, Jai Anuprayog in indigenisation and critically assess India''s self-reliance in AI and robotics.', null, 'critically assess', false,
  'S&T > Indigenisation > AI & Robotics', ARRAY['ai-robotics','indigenisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Examine the institutional, financial and technological barriers to full indigenisation in space, IT and defence.', null, 'examine', false,
  'S&T > Indigenisation', ARRAY['indigenisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Assess whether Space Policy 2023''s private-sector opening changed security and disaster capacity, and propose a strategy.', null, 'assess', false,
  'S&T > Space > Policy', ARRAY['policy','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Analyse social media as a force multiplier for internal security threats and the security-versus-liberty dilemma, and suggest a strategy.', null, 'analyse', false,
  'S&T > Cyber > Internal Security', ARRAY['cyber','internal-security']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Assess how far STEM expansion has narrowed Bihar''s regional education gaps and discuss the digital-divide and teacher-capacity problems.', null, 'assess', true,
  'S&T > Education > STEM', ARRAY['bihar','education','stem']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Explain how science and technology raise farm productivity and help preserve food.', null, 'explain', false,
  'S&T > Agri-tech', ARRAY['agri-tech']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Explain with examples how drones aid India''s national security.', null, 'explain', false,
  'S&T > Defence > Drones', ARRAY['defence','drones']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss how Chandrayaan and Mangalyaan raised India''s space standing and their uses in farming, disasters and urban planning.', null, 'discuss', false,
  'S&T > Space > Missions', ARRAY['missions','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Describe how DNA fingerprinting helps forensic science.', null, 'describe', false,
  'S&T > Biotech > DNA Fingerprinting', ARRAY['biotech','dna-fingerprinting']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Justify why science and technology are needed everywhere, from cancer treatment to ticket booking.', null, 'justify', false,
  'S&T > General Applications', ARRAY['general-applications']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Define cybercrime, list its types, and explain how technology helps reduce it.', null, 'explain', false,
  'S&T > Cyber Crime', ARRAY['cyber-crime']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain Wi-Fi and its contribution to India''s economy, infrastructure and higher education.', null, 'explain', false,
  'S&T > ICT > Wi-Fi', ARRAY['ict','wi-fi']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Define STEM education and its value for quality schooling in Bihar and the future workforce.', null, 'describe', true,
  'S&T > Education > STEM', ARRAY['bihar','education','stem']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain with examples how misuse of technology has harmed India''s environment.', null, 'explain', false,
  'S&T > Environment', ARRAY['environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of technology in sustainable development.', null, 'discuss', false,
  'S&T > Sustainable Development', ARRAY['sustainable-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of computers in modern society.', null, 'discuss', false,
  'S&T > ICT > Computers', ARRAY['computers','ict']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain with examples the link between technology and social development.', null, 'explain', false,
  'S&T > Tech & Society', ARRAY['tech-society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of science and technology in Bihar''s industrial development.', null, 'discuss', true,
  'S&T > Industry > Bihar', ARRAY['bihar','industry']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain why India must expand nuclear power and the precautions this requires.', null, 'explain', false,
  'S&T > Nuclear Energy', ARRAY['nuclear-energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the government''s role in water conservation for tap water to every home, and the technology Bihar has used toward this goal.', null, 'discuss', true,
  'S&T > Water > Bihar', ARRAY['bihar','water']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain the significance of indigenisation of technology for India.', null, 'explain', false,
  'S&T > Indigenisation', ARRAY['indigenisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Distinguish the internet from an intranet and explain how they have changed human life.', null, 'explain', false,
  'S&T > ICT', ARRAY['ict']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss cyber-threat areas in the public and government domains and the Centre''s countermeasures.', null, 'discuss', false,
  'S&T > Cyber Security', ARRAY['cyber-security']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Write a note on technology-driven modernisation of Bihar.', null, 'write a note', true,
  'S&T > Bihar > Modernisation', ARRAY['bihar','modernisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Justify the statement that technology is more a curse than a blessing in the context of pollution.', null, 'justify', false,
  'S&T > Environment > Pollution', ARRAY['environment','pollution']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of technology in Bihar''s agricultural development for food and nutrition security.', null, 'discuss', true,
  'S&T > Agri-tech > Bihar', ARRAY['agri-tech','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Justify with examples that nanotechnology can improve human life. (Also asked: 68th, 69th — in health)', null, 'justify', false,
  'S&T > Nanotech', ARRAY['nanotech']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Justify, from advances in defence technology, that Make in India has strengthened India''s defence capability.', null, 'justify', false,
  'S&T > Defence Technology', ARRAY['defence-technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss India''s space research aimed at finding life on other planets.', null, 'discuss', false,
  'S&T > Space > Exploration', ARRAY['exploration','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Describe how India countered Covid-19 in light of Make in India. (Also asked: 69th)', null, 'describe', false,
  'S&T > Health > Covid-19', ARRAY['covid-19','health']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain the role of science and technology in forecasting and managing disasters, especially floods and drought in Bihar. (Also asked: 66th, 67th)', null, 'explain', true,
  'S&T > Disaster Management > Bihar', ARRAY['bihar','disaster-management']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss with examples the role of science and technology in driving Make in India.', null, 'discuss', false,
  'S&T > Make in India', ARRAY['make-in-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss scientific initiatives addressing population pressure, health risks, resource degradation and shrinking farmland.', null, 'discuss', false,
  'S&T > Health & Resources', ARRAY['health-resources']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss how science and technology can ease the Covid-19 employment crisis and sustain development.', null, 'discuss', false,
  'S&T > Employment', ARRAY['employment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'India has many rivers yet lacks drinking water; discuss the role of science and technology in water management.', null, 'discuss', false,
  'S&T > Water Management', ARRAY['water-management']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Describe how science and technology can meet rising electricity demand as conventional sources deplete.', null, 'describe', false,
  'S&T > Energy', ARRAY['energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Give your vision of smart cities and explain the role of science and technology in building them.', null, 'explain', false,
  'S&T > Smart Cities', ARRAY['smart-cities']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the types of waste and how technology can tackle waste from population growth and poor planning.', null, 'discuss', false,
  'S&T > Waste Management', ARRAY['waste-management']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'The power of mindset in shaping human destiny.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Technology as a double-edged sword: balancing innovation and control.', null, 'write an essay', false,
  'Essay > Technology', ARRAY['technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Ethics in action: why moral courage matters more than opinion.', null, 'write an essay', false,
  'Essay > Ethics', ARRAY['ethics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Geopolitical implications of rising tensions in the Middle East.', null, 'write an essay', false,
  'Essay > International Relations', ARRAY['international-relations']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'India''s importance in today''s global context.', null, 'write an essay', false,
  'Essay > International Relations', ARRAY['international-relations']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'National development and information technology.', null, 'write an essay', false,
  'Essay > Technology & Development', ARRAY['technology-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Environmental imbalance is the destroyer of creation.', null, 'write an essay', false,
  'Essay > Environment', ARRAY['environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Soil conservation and organic farming.', null, 'write an essay', false,
  'Essay > Agriculture & Environment', ARRAY['agriculture-environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Science and technology help us understand the mysteries of the universe.', null, 'write an essay', false,
  'Essay > Science & Technology', ARRAY['science-technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Better farming systems can strengthen the rural economy.', null, 'write an essay', false,
  'Essay > Agriculture', ARRAY['agriculture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'The black economy is the root of crime and corruption.', null, 'write an essay', false,
  'Essay > Economy & Corruption', ARRAY['economy-corruption']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'The communication revolution has raised public awareness.', null, 'write an essay', false,
  'Essay > Communication', ARRAY['communication']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'A forest grows its own trees; it does not wait for others to sow seeds.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Literature is not just a source of knowledge but a form of moral and social action.', null, 'write an essay', false,
  'Essay > Literature & Society', ARRAY['literature-society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Do your duty, for action is better than inaction.', null, 'write an essay', false,
  'Essay > Philosophical (Gita)', ARRAY['philosophical-gita']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Good art illuminates experience or reveals truth.', null, 'write an essay', false,
  'Essay > Art', ARRAY['art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'AI and human values: can machines understand morality?', null, 'write an essay', false,
  'Essay > AI & Ethics', ARRAY['ai-ethics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Environmental responsibility in an age of industrial expansion.', null, 'write an essay', false,
  'Essay > Environment', ARRAY['environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Love and knowledge: the twin pillars of a meaningful life.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'De-dollarisation and the changing global economic order.', null, 'write an essay', false,
  'Essay > Global Economy', ARRAY['global-economy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Political will and national security.', null, 'write an essay', false,
  'Essay > Security & Governance', ARRAY['security-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'End of corruption and upliftment of the nation.', null, 'write an essay', false,
  'Essay > Corruption & Governance', ARRAY['corruption-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Lax law and order is a hindrance to women''s empowerment.', null, 'write an essay', false,
  'Essay > Women Empowerment', ARRAY['women-empowerment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'World welfare is impossible without spiritual consciousness.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Women''s empowerment seen through political empowerment.', null, 'write an essay', false,
  'Essay > Women Empowerment', ARRAY['women-empowerment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Importance of yoga for spiritual, physical and mental development.', null, 'write an essay', false,
  'Essay > Health & Spirituality', ARRAY['health-spirituality']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Pros and cons of the New Education Policy.', null, 'write an essay', false,
  'Essay > Education Policy', ARRAY['education-policy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Impact of climate change on Indian agriculture and ways to protect it.', null, 'write an essay', false,
  'Essay > Environment & Agriculture', ARRAY['environment-agriculture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'We are not makers of history; we are made by history.', null, 'write an essay', false,
  'Essay > History', ARRAY['history']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'The internet has turned our world into a global village.', null, 'write an essay', false,
  'Essay > Technology', ARRAY['technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Thought is the basis of life.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Education seeking change after Covid.', null, 'write an essay', false,
  'Essay > Education', ARRAY['education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बाँदर की जानैत अहि अदरक्क स्वाद', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अधजल घैला छलकैत जाए', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'जेकरा लाठी ओकरा भैंस', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अकेला चना भाड़ न फोड़ि सकेला', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बनले के साथी सब केहू ह अउरी बिगड़ले के केहु नाहीं', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'जिअते माछी नाहीं घोंटाई', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बापक नाम साग पात आ बेटाक नाम परोर', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'जइसन बोअबऽ ओइसने कटबऽ', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बिन समाज के बोली हो सकेला का, बिन बोली समाज हो सकेला का!', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'धोबियक कुकुर ने घर के ने घाट के', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'आगु नाथ ने पाछू पगहा, बिना छान के कूदे गधा', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अनेर धुनेर के राम रखवार', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'धर्म के बिना विज्ञान नंगर, विज्ञान के बिना धर्म आन्हर', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'पानी में मछरिया, नौ-नौ कुटिया बखरा', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अगिला खेती आगे-आगे, पछिला खेती भागे-जागे', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'मूस मोटइहें, लोढ़ा होइहें, ना हाथी, ना घोड़ा होइहें', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
);
