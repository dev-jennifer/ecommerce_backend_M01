const ProductDTO = require('../classes/Products/ProductsDTO.class'),
  ProductDAOFactory = require('../classes/Products/ProductDAOFactory.class'),
  APICustom = require('../classes/Error/customError'),
  fs = require('fs');
const { upload } = require('../utils/functions');
class ProductsController {
  constructor() {
    this.ProductsDAO = ProductDAOFactory.get();
    this.message = new APICustom();
  }
  ///////FUNCIONES GENERALES////////
  productsAll = async () => {
    const docs = await this.ProductsDAO.mostrarTodos();
    const productos = docs.map((p) => {
      return new ProductDTO(p);
    });

    return productos;
  };

  categories = async () => {
    const cat = await this.ProductsDAO.mostrarTodasCategorias();
    return cat;
  };

  productId = async (id) => {
    const doc = await this.ProductsDAO.mostrarId(id);
    const productsDto = new ProductDTO(doc);
    return productsDto;
  };

  productCategory = async (id) => {
    try {
      const docs = await this.ProductsDAO.mostrarCategoria(id);
      const productos = docs.map((p) => {
        return new ProductDTO(p);
      });
      return productos;
    } catch (error) {
      this.message.errorNotFound(error, 'categoria no encontrada');
    }
  };

  ///////PRINT JSON////////
  getProducts = async (req, res) => {
    try {
      res.status(200).json({ product: await this.productsAll() });
    } catch (error) {
      this.message.errorNotFound(error, 'productos no encontrado');
    }
  };

  getProductId = async (req, res) => {
    const id = req.params.id;
    try {
      res.status(200).json({ producto: await this.productId(id) });
    } catch (error) {
      this.message.errorNotFound(error, 'producto no encontrado');
    }
  };

  getCategoriaId = async (req, res) => {
    const id = req.params.id;
    try {
      res
        .status(200)
        .json({ producto: await this.ProductsDAO.mostrarCategoria(id) });
    } catch (error) {
      this.message.errorNotFound(error, 'categoria id no encontrado');
    }
  };

  saveProducts = async (req, res) => {
    await this.ProductsDAO.guardar({
      ...req.body,
      foto: req.files,
    })

      .then(() => {
        console.log(req.files);
        res.status(200).json({ status: true, result: 'Producto Guardado' });
      })
      .catch((error) => {
        this.message.errorInternalServer(
          error,
          'No se ha podido guardar el producto'
        );
      });
  };

  deleteProduct = async (req, res) => {
    const product = await this.ProductsDAO.mostrarId(req.params.id);

    try {
      if (product.foto) {
        for (let i = 0; i < product.foto.length; i++) {
          fs.unlink(
            './public/uploads/' + product.foto[i].filename,
            function (err, result) {
              if (err) console.log('error', err);
            }
          );
        }
      }
    } catch (error) {
      this.message.errorNotFound(error, 'Error al eliminar producto');
    }

    await this.ProductsDAO.eliminar('id', req.params.id).then(() => {
      console.log(`Eliminado ${req.params.id}`);
    });
  };

  editProductImagen = async (req, res) => {
    const id = req.params.id;
    const body = req.body;

    try {
      const newDetail = await this.ProductsDAO.actualizar(id, {
        foto: body.dataObj,
      });
      console.log(body.dataObj);
      fs.unlink('./public/uploads/' + body.filename, function (err, result) {
        if (err) console.log('error', err);
      });
    } catch (err) {
      this.message.errorNotFound(err, 'Error al eliminar foto producto');
    }
  };

  discountStock = async (req, res) => {
    const body = req.body;
    console.log('BODY', body);
    try {
      let doc = await this.ProductsDAO.mostrarId(body.id);
      let newStock = doc.stock - body.cantidad;
      console.log('doc.stock', doc.stock);
      console.log('newStock', newStock);
      await this.ProductsDAO.actualizar(body.id, { stock: newStock });


    } catch (error) {
      this.message.errorInternalServer(
        error,
        ' No se ha podido editar producto'
      );
    }
  };
  formEditProduct = async (req, res) => {
    const id = req.params.id;

    await this.ProductsDAO.mostrarId(id)
      .then((result) => {
        res.status(200).json({ title: 'Editar', data: result });
      })
      .catch((error) => {
        this.message.errorInternalServer(
          error,
          ' No se ha podido editar producto'
        );
      });
  };

  editProduct = async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    console.log(req.files);

    try {
      if (req.files) {
        let doc = await this.ProductsDAO.mostrarId(id);
        // console.log('doc', doc);
        const fotoNueva = req.files;
        console.log('NUEVO', fotoNueva);

        let fotos = doc.foto.concat(fotoNueva);

        await this.ProductsDAO.actualizar(id, { foto: fotos });
        res.status(200).send(`Producto actualizado  ${id}`);
      } else {
        console.log('BP', body);
        await this.ProductsDAO.actualizar(id, body);
        res.status(200).send(`Producto actualizado  ${id} - ${body}`);
      }
    } catch (error) {
      this.message.errorInternalServer(
        error,
        ' No se ha podido editar producto'
      );
    }
  };
}

module.exports = ProductsController;