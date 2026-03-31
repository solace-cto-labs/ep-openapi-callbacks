import { Request, Response, NextFunction } from 'express';
import subscriptionmanager from '../services/subscriptionmanager.js';


class Callbacks {

  public async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const response = await subscriptionmanager.subscribe(req.body, req.originalUrl);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  public async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const response = await subscriptionmanager.unsubscribe(req.originalUrl, req.query?.callbackId as string);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

}

export default new Callbacks();

