import {h,  Component, render} from 'preact';
import { map, trim } from 'lodash';
import rwc from 'random-weighted-choice';

class CheckInForm extends Component {

  constructor(props) {
    super(props);
    this.state = {
      visible: true,
      error: null,
      entries: []
    };
  }

  entryChanged = (entry) => {
    console.log('entryChanged', e);
  };

  addEntry = () => {
    if (this.state.entries.length === 30) {
      this.showError("Too many entries.");
      return;
    }
    let newEntryName = trim(document.querySelectorAll("input#newEntryName")[0].value);
    let newEntryWeight = trim(document.querySelectorAll("input#newEntryWeight")[0].value);
    if (newEntryName.length && newEntryName.length <= 15) {
      this.state.entries.push({
        id: newEntryName,
        weight: 1
      });
      this.setState({
        entries: this.state.entries
      });
    }
  };

  showError = (err) => {
    this.setState({error: err});
    this.setTimeout(()=> {
      this.state.error = null;
    }, 5000);
  };

  go = (e) => {
    e.preventDefault();
    let entries = [];
    for (let i = 0; i < 30; i++) {
      entries.push({
        id: rwc(this.state.entries)
      });
    }
    this.setState({visible: false});
    this.props.app.initGame(entries);
  };

  test = (e) => {
    e.preventDefault();
    this.setState({visible: false});
    this.props.app.initGame(null);
  };

  render() {
    console.log('state', this.state);
    if (!this.state.visible) return null;
    let htmlENtries = this.state.entries.length ? (
      <div id="entries">
        {map(this.state.entries, (entry, i) => (
          [
            <input className="entryName" type="text" maxLength="15" name="newEntry" placeholder="Entry"
                   value={entry.id} onChange={this.entryChanged.bind(this, entry)}
            />,
            <input className="entryWeight" type="number" name="newWeight" placeholder="Weight"
                   value={entry.weight} onChange={this.entryChanged.bind(this, entry)}
            />
          ]
        ))}
      </div>
    )  : null;
    let {error} = this.state;
    return (
      <div class="login-wrapper">
        <div className="vAlign">
          <div className="login" onSubmit={(e) => e.preventDefault()}>
            <h2>Will you dare spining the</h2>
            <h1>Wheel Of Fate</h1>
            <h5>
              Add your entries to be picked by the Wheel of Fate<br/>
              Or Try or Demo.
            </h5>
            {error ? <p>{error}</p>: null}
            <form onSubmit={this.go} id="entryForm" method="post">
              {htmlENtries}
              <div id="newEntry">
                <input id="newEntryName" type="text" maxLength="10" placeholder="Entry"/>
                <input id="newEntryWeight" type="number" placeholder="Weight"/>
              </div>

              <button onClick={this.addEntry} type="button" class="addEntry btn btn-primary btn-block btn-large">Add Entry</button>

              <button onClick={this.test} type="button" class="tryTest btn btn-primary btn-block btn-large">Try the Demo</button>

              {this.state.entries.length >= 2 ? <button onClick={this.go} type="button" class="btn btn-primary btn-block btn-large btn-red">Go!</button>:null}
            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default CheckInForm;