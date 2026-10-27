using {rental.equipment as db} from '../db/schema';

@path    : '/odata/v4/identity'
@requires: 'authenticated-user'
service IdentityService {
  entity AppUsers as projection on db.AppUsers excluding {
    passwordHash
  };

  action createUser(
    username: String,
    displayName: String,
    password: String,
    role: String,
    plant: String,
    email: String
  ) returns AppUsers;

  action setUserActive(userID: UUID, active: Boolean) returns AppUsers;
}
