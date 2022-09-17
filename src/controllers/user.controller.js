const bcrypt = require('bcrypt'),
  APICustom = require('../classes/Error/customError'),
  sendEmail = require('../notificaciones/emails/Registration/newUser'),
  UserFactory = require('../classes/User/UserFactory.class'),
  jwt = require('jsonwebtoken'),
  config = require('../utils/config'),
  passwordChange = require('../notificaciones/emails/Login/passwordChange'),
  sendNewPasswordEmail = require('../notificaciones/emails/Login/forgotPassword');
class UserController {
  constructor() {
    this.userDAO = UserFactory.get();
    this.message = new APICustom();
  }
  renderProfile = async (req, res) => {
    await this.userDAO
      .mostrarEmail(req.params.id)
      .then((result) => {
        res.status(200).json({ data: result });
      })
      .catch((error) => {
        this.message.errorInternalServer(error, 'error al obtener perfil');
      });
  };

  renderLogOut = (req, res, next) => {
    try {
      req.session.destroy((err) => {
        res.clearCookie('jwt');
        res.redirect('/');

        if (err) next(err);
      });
    } catch (error) {
      const mensaje = 'Error al cerrar sesion';
      this.message.errorInternalServer(error, mensaje);
    }
  };
  register = async (req, email, password, done) => {
    try {
      const user = await this.userDAO.mostrarEmail(email);

      if (user) {
        done(null, false, {
          message: 'The Email is already Taken',
        });
      } else {
        req.body.email = email;
        password = bcrypt.hashSync(
          req.body.password,
          bcrypt.genSaltSync(5),
          null
        );

        const phoneFull = '+' + req.body.country + req.body.phone;
        const newUserRegister = {
          email: email,
          password: password,
          phone: phoneFull,
          name: req.body.name,
          lastName: req.body.lastName,
          address: req.body.address,
          age: req.body.age,
          avatar: req.file.filename,
          membershipID: 2, //no admin por defecto
        };

        await this.userDAO.guardar(newUserRegister);
        done(null, newUserRegister, sendEmail(newUserRegister));
      }
    } catch (error) {
      const mensaje = 'Error al crear usuario';
      this.message.errorInternalServer(error, mensaje);
    }
  };

  existPassport = async (email) => {
    const user = await this.userDAO.mostrarEmail(email);
    return user;
  };
  getUsers = async (req, res) => {
    const docs = await this.userDAO.mostrarTodos();
    return res.status(200).json({ users: docs });
  };
  editProfile = async (req, res) => {
    const id = req.params.id;
    let datos = req.body;
    console.log('datos', datos);
    try {
      if (datos.password) {
        let newPassword = bcrypt.hashSync(
          req.body.password,
          bcrypt.genSaltSync(5),
          null
        );
        console.log('newPassword', newPassword);
        datos = { password: newPassword };
      }
      const newUser = await this.userDAO.actualizarPorEmail(id, datos);

      res.status(200).json({ Perfil_actualizado: newUser });
    } catch (error) {
      const mensaje = 'Error al editar el perfil';
      this.message.errorInternalServer(error, mensaje);
    }
  };

  forgot = async (req, res) => {
    let user = await this.userDAO.mostrarEmail(req.body.email);

    if (!user) {
      res.status(422).json({
        errors: [{ title: 'Invalid email!', detail: 'User does not exist' }],
      });
    } else {
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
        },
        config.JWT.SECRET,
        { expiresIn: '1h' }
      );

      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000;
      res.status(200).json({
        errors: [
          {
            title: 'Correo Enviado',
            detail: 'Se ha enviado el correo para restablecer',
          },
        ],
      });
      console.log('user', user);
      await this.userDAO.actualizarPorEmail(user.email, user);
      sendNewPasswordEmail(token);
    }
  };

  checkToken = async (req, res) => {
    let user = await this.userDAO.buscarCondicionBody({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    console.log(user);
    if (!user) {
      return res.status(422).send({
        errors: [
          {
            title: 'El token se ha vencido o no existe.',
            detail: ' Restaure la contraseña nuevamente',
          },
        ],
      });
    } else {
      return res.status(200).send({ token: req.params.token });
    }
  };

  updatePassword = async (req, res) => {
    let user = await this.userDAO.buscarCondicionBody({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    console.log(user);
    if (!user) {
      `enter code here`;
      return res.status(422).send({
        errors: [
          {
            title: 'error',
            detail: 'Password reset token is invalid or has expired',
          },
        ],
      });
    }
    if (req.body.password === req.body.confirm) {
      console.log(req.body);
      let newPassword = bcrypt.hashSync(
        req.body.password,
        bcrypt.genSaltSync(5),
        null
      );
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await this.userDAO.guardar(user);
      passwordChange(user.email);
    } else {
      return res.status(422).send({
        errors: [{ title: 'error', detail: 'Password do not match' }],
      });
    }
  };

  deleteUser = async (req, res) => {
    console.log(req.params.id);
    try {
      await this.userDAO.eliminar('email', req.params.id);
      res.status(200).json('Elemento eliminado');
    } catch (error) {
      const mensaje = 'Error al borrar usuario';
      this.message.errorInternalServer(error, mensaje);
    }
  };

  login = (req, res) => {
    return async (email, password, done) => {
      try {
        const user = await this.userDAO.mostrarEmail(email);

        if (!user) {
          done(null, false, {
            errors: [{ title: 'error', detail: 'Password do not match' }],
          });
        } else {
          bcrypt.compare(password, user.password).then((isMatch) => {
            if (isMatch) {
              const payload = {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
              };
              jwt.sign(
                payload,
                'secret',
                {
                  expiresIn: 3600,
                },
                (err, token) => {
                  if (err) console.error('There is some error in token', err);
                  console.log('OKA');

                  res
                    .status(200)
                    .json({ success: true, token: `Bearer ${token}` });
                }
              );
            } else {
              done(null, false, {
                errors: [{ title: 'error', detail: 'Password do not match' }],
              });
            }
          });
        }
      } catch (error) {
        const mensaje = 'Error al iniciar sesion';
        return this.message.errorAuth(error, mensaje);
      }
    };
  };
}

module.exports = UserController;