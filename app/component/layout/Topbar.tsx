import { LoaderArgs, json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { useLocation } from 'react-router-dom';
import { Usuario } from '@prisma/client';
import { getPageInfo } from '~/shared/PageInfo';

import { authenticator } from '~/secure/authentication.server';

import userImage from '~/assets/img/user.png';

export const loader = ({ request }: LoaderArgs) => {
  let usuario = authenticator.isAuthenticated(request);
  return json({ usuario });
};

export default function Topbar() {
  const { usuario, perfil, feirasAtuais, feiraHojeId } = useLoaderData();
  const location = useLocation();
  const info = getPageInfo(location.pathname);

  // Uma feira atual: vai direto pra ela. Mais de uma: vai pra lista do calendário
  const linkFeira =
    feirasAtuais?.length === 1
      ? `/calendario/feira/${feirasAtuais[0].id}`
      : feirasAtuais?.length > 1
        ? '/calendario'
        : null;

  return (
    usuario && (
      <header>
        <h2>
          <label htmlFor='nav-toggle'>
            <span className='las la-bars'></span>
          </label>
          {info?.title}
        </h2>

        <div className='topbar-actions'>
          {feiraHojeId && (
            <Link to={`/calendario/feira/${feiraHojeId}?selling`} className='topbar-feira topbar-venda'>
              <span className='las la-cash-register'></span>
              Cadastrar venda
            </Link>
          )}

          {linkFeira && (
            <Link to={linkFeira} className='topbar-feira'>
              <span className='las la-store'></span>
              {feirasAtuais.length === 1 ? 'Minha feira' : 'Minhas feiras'}
            </Link>
          )}

          <div className='user-wrapper'>
            <img src={userImage} alt='some random user image' width={'40px'} height={'40px'} />
            <div>
              <h4>{perfil?.nome ? `${perfil?.nome} ${perfil?.sobrenome}` : usuario.email}</h4>
              <small>
                <Link to='/perfil'>Meu perfil</Link>
                {' | '}
              </small>
              <small>
                <Link to='/autentica/sair'>Sair</Link>
              </small>
            </div>
          </div>
        </div>
      </header>
    )
  );
}
