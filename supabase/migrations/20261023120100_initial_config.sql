-- Configuração inicial real do estúdio (não são reservas nem dados fictícios).

insert into public.professionals (display_name, brand_name, welcome_message)
values (
  'BEATRIZ ABREU',
  'Bia Nail Studio',
  'Unhas lindas, com carinho e cuidado em cada detalhe. Escolha seu serviço e reserve seu horário em poucos toques.'
);

insert into public.services (name, price_cents, sort_order) values
  ('Fibra', 13000, 10),
  ('Gel na tips', 10000, 20),
  ('Banho de gel', 8000, 30),
  ('Esmaltação em gel', 7000, 40),
  ('Manicure e pedicure', 5000, 50),
  ('Manicure', 3000, 60),
  ('Pedicure', 3000, 70),
  ('Manutenção de fibra', 10000, 80),
  ('Manutenção de gel na tips', 9000, 90),
  ('Manutenção de banho de gel', 7000, 100);

-- Segunda a sábado, 13h às 18h. Domingo fechado.
insert into public.business_hours (weekday, is_open, open_time, close_time) values
  (0, false, null, null),
  (1, true, '13:00', '18:00'),
  (2, true, '13:00', '18:00'),
  (3, true, '13:00', '18:00'),
  (4, true, '13:00', '18:00'),
  (5, true, '13:00', '18:00'),
  (6, true, '13:00', '18:00');

-- Os horários de início (available_slots) NÃO são criados aqui:
-- a profissional define cada horário em Painel > Configurações.
