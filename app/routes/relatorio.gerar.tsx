import { Papel } from '@prisma/client';
import { ActionFunctionArgs } from '@remix-run/node';
import xlsx from 'node-xlsx';
import { authenticator } from '~/secure/authentication.server';

type RelatorioAba = {
  nome: string;
  data: Array<Array<string | number>>;
};

type RelatorioPayload = {
  nome?: string;
  aba?: string;
  data?: Array<Array<string | number>>;
  abas?: RelatorioAba[];
};

export async function action({ request }: ActionFunctionArgs) {
  const usuario = await authenticator.isAuthenticated(request, {
    failureRedirect: '/autentica/entrar',
  }) as { papel: Papel };

  if (usuario.papel !== Papel.ADMIN) {
    return new Response(JSON.stringify({ message: 'Permissao negada.' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const payload = (await request.json()) as RelatorioPayload;

  const abas =
    payload?.abas?.filter((aba) => Array.isArray(aba?.data) && aba.data.length > 0) ?? [];

  if (!abas.length && !payload?.data?.length) {
    return new Response(JSON.stringify({ message: 'Dados do relatorio nao informados.' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const planilha = xlsx.build(
    (abas.length
      ? abas
      : [
          {
            nome: payload.aba || 'Relatorio',
            data: payload.data ?? [],
          },
        ]
    ).map((aba) => ({
      name: aba.nome,
      data: aba.data,
      options: {},
    })) as any
  );

  const nomeArquivo = (payload.nome || 'relatorio').replace(/\s+/g, '_');

  return new Response(planilha, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomeArquivo}.xlsx"`,
    },
  });
}
